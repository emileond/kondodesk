import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Setup dayjs with UTC plugin
dayjs.extend(utc);

export async function onRequestPost(context) {
    const body = await context.request.json();
    const { startDate, endDate, availableDates, workspace_id } = body;
    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

    // fetch backlog from supabase
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

    const { data: backlog } = await supabase
        .from('tasks')
        .select('id, name, description, priority, project_id, milestone_id')
        .eq('workspace_id', workspace_id)
        .is('date', null)
        .eq('status', 'pending')
        .order('order')
        .limit(50);

    const prompt = `You are a friendly and intelligent planning assistant. Your goal is to schedule tasks from a backlog onto a calendar, respecting user workload and constraints. Generate a balanced schedule for the user between ${startDate} and ${endDate}.

Inputs:
- availableDates: an array of objects containing UTC ISO-8601 datetimes (start-of-day) and weekday names on which you MAY place new tasks. Do NOT schedule tasks on any dates _not_ in this list: ${JSON.stringify(availableDates)} 
- backlog: An array of unscheduled tasks, ordered by priority (earlier items should be scheduled first): ${JSON.stringify(backlog)}
- dateRange: Schedule tasks from ${startDate} (inclusive) to ${endDate} (inclusive) in UTC.

Requirements:
1.  **Strict Whitelist**: You may only assign tasks to dates in \`availableDates\`. If a backlog item cannot fit on any of those dates, leave it unscheduled.
2.  **Max 3 Tasks per Day**: None of the provided availableDates have ≥3 existing tasks, so you only need to worry about distributing the backlog intelligently.
3.  **Context-Aware Distribution**: Instead of evenly distributing tasks, consider both the task context (name and description) and the day of the week. For example:
   - Schedule collaborative tasks on Mondays and Tuesdays.
   - Schedule deep work, coding, and creative tasks on Wednesdays and Thursdays.
   - Schedule planning, reviews, and lighter tasks on Fridays.
   - Match task content with appropriate days (e.g., "weekly review" tasks on Fridays).

Output Format:
- Return ONLY a single JSON object.
- The object must have two keys: "plan" and "reasoning".
- "plan": An array of objects representing *only the tasks from the backlog that you were able to schedule*. Each object must have "id" and "date".
- "reasoning": A brief, user-friendly summary (2-3 sentences) explaining the logic behind the schedule. The tone should be neutral, calm, and encouraging, like a helpful assistant (think Sunsama or Headspace). **Crucially, do not use first-person pronouns like "I" or "we".** Frame the explanation from the app's perspective. For example, instead of "I scheduled creative tasks...", say "This plan prioritizes creative tasks mid-week, with lighter reviews scheduled for Friday to ensure a balanced and productive week."

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
