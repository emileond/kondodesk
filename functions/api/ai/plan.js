import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Setup dayjs with UTC plugin
dayjs.extend(utc);

export async function onRequestPost(context) {
    const body = await context.request.json();
    const { startDate, endDate, availableDates, workspace_id, user_id } = body;
    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

    // fetch backlog from supabase
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

    const [backlogResult, eventsResult] = await Promise.all([
        supabase
            .from('tasks')
            .select('id, name, description, priority, project_id, milestone_id')
            .eq('workspace_id', workspace_id)
            .eq('assignee', user_id)
            .is('date', null)
            .eq('status', 'pending')
            .order('order')
            .limit(50),
        supabase
            .from('events')
            .select('title, start_time, end_time')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id)
            .gte('start_time', startDate)
            .lte('start_time', endDate),
    ]);

    if (backlogResult.error || eventsResult.error) {
        console.error(
            'Error fetching data from Supabase:',
            backlogResult.error || eventsResult.error,
        );
        return new Response(JSON.stringify({ error: 'Failed to fetch necessary data.' }), {
            status: 500,
        });
    }

    const backlog = backlogResult.data;
    const userEvents = eventsResult.data;

    function summarizeDailyWorkload(events) {
        const dailyWorkload = {};

        for (const event of events) {
            const eventDate = dayjs(event.start_time).utc().format('YYYY-MM-DD');
            if (!dailyWorkload[eventDate]) {
                dailyWorkload[eventDate] = { eventCount: 0, titles: [] };
            }
            dailyWorkload[eventDate].eventCount++;
            dailyWorkload[eventDate].titles.push(event.title);
        }
        return dailyWorkload;
    }

    // In your main function:
    const currentDateUTC = dayjs().utc().toISOString();
    const dailySummary = summarizeDailyWorkload(userEvents || []);

    const prompt = `You are an expert planning assistant. Your goal is to intelligently schedule tasks from a backlog onto a calendar.

**Context:**
- Current Datetime (UTC): ${currentDateUTC}
- Planning Range (UTC): ${startDate} to ${endDate}

**Inputs:**
- availableDates: An array of objects with UTC dates (start-of-day) and weekdays where you can schedule tasks. You must only use dates from this list: ${JSON.stringify(availableDates)} 
- backlog: An array of unscheduled tasks, ordered by priority: ${JSON.stringify(backlog)}
- existingWorkload: A JSON object summarizing the user's existing commitments. Keys are dates ('YYYY-MM-DD'), and values show the number of events: ${JSON.stringify(dailySummary)}

**Requirements:**
1.  **Dynamic Workload Balancing**: Use the \`existingWorkload\` summary to balance the schedule.
    - **On Busy Days**: If a day shows a high \`eventCount\`, schedule only 1-2 new, low-effort tasks.
    - **On Open Days**: If a day has an \`eventCount\` of 0 or 1, use it for more substantial, high-effort tasks.
    - **Hard Limit**: Never schedule more than 3 new tasks on any single day.
2.  **Strict Whitelist**: Only assign tasks to dates present in the \`availableDates\` array.
3.  **Context-Aware Distribution**: Consider the task's name/description and the day of the week for thematic scheduling (e.g., deep work mid-week, reviews on Fridays).

**Output Format:**
- Return ONLY a single JSON object.
- The object must have two keys: "plan" and "reasoning".
- "plan": An array of scheduled tasks. Each object must have "id" (string) and "date" (string in "YYYY-MM-DD" format).
- "reasoning": A **narrative summary** written in the voice of a calm, encouraging, and strategic project manager (think of the tone used by apps like Asana, Sunsama, or Notion). It must sound natural and human, not like a computer listing its steps. Use simple Markdown for clarity (bolding for emphasis and new paragraphs for structure).

  The narrative must have three parts:
  1.  **A Clear Headline:** Start with a single, confident sentence that frames the outcome.
  2.  **The Strategic Narrative:** In a short paragraph (2-3 sentences), explain the "story" of the plan, using one or two specific examples to illustrate the strategy. For instance, mention a key project or a specific day that exemplifies the plan. Describe the core strategy and how it helps the user. **Do not** simply list the rules you followed.
  3.  **A Forward-Looking Close:** End with a single, positive sentence that encourages the user.

Return only the valid JSON object as your response.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        description: 'The array of scheduled tasks.',
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: 'Task ID' },
                                date: {
                                    type: Type.STRING,
                                    description: 'Assigned date, full UTC ISO-8601 timestamp',
                                },
                            },
                            required: ['id', 'date'],
                        },
                    },
                    reasoning: {
                        type: Type.STRING,
                        description:
                            'A brief summary of the planning logic in a neutral, app-centric tone.',
                    },
                },
                required: ['plan', 'reasoning'],
            },
        },
    });

    let parsedResponse;
    try {
        parsedResponse = JSON.parse(response.text);

        // Update the dates of tasks in the database based on the AI's response
        if (Array.isArray(parsedResponse.plan)) {
            const updatePromises = parsedResponse.plan.map((task) => {
                const dateToUse = typeof task.date === 'string' ? task.date : task.date.date;
                return supabase.from('tasks').update({ date: dateToUse }).eq('id', task.id);
            });

            const results = await Promise.all(updatePromises);

            results.forEach((result, index) => {
                if (result.error) {
                    console.error(
                        `Failed to update task ${parsedResponse.plan[index].id}:`,
                        result.error,
                    );
                }
            });
        }
    } catch (e) {
        console.error('Error parsing AI response:', e);
        // If parsing fails, return a default error structure
        return Response.json(
            {
                plan: [],
                reasoning: "Sorry, I couldn't generate a plan right now. Please try again.",
            },
            { status: 500 },
        );
    }

    return Response.json(parsedResponse);
}
