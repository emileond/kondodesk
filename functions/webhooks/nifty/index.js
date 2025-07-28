import { createClient } from '@supabase/supabase-js';

// Helper function to convert plain text to a basic Tiptap/JSON format
function toTiptap(text) {
    if (!text) return null;
    return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    };
}

async function handleTaskEvent(supabase, task) {
    // 1. Get Nifty assignee IDs from the payload.
    const niftyAssigneeIds = task.assignees?.map((a) => a.member).filter(Boolean) || [];

    // If no one is assigned, there's nothing to do.
    if (niftyAssigneeIds.length === 0) {
        console.log(`Nifty task ${task.id} has no assignees, no action taken.`);
        return;
    }

    // 2. Find which of these assignees have an active integration in your app.
    const { data: userMappings, error: mappingError } = await supabase
        .from('user_integrations')
        .select('user_id, workspace_id')
        .eq('integration_source', 'nifty')
        .in('external_data->>id', niftyAssigneeIds);

    if (mappingError) throw new Error(`Failed to map Nifty users: ${mappingError.message}`);

    const usersToSync = userMappings || [];
    if (usersToSync.length === 0) {
        console.log(`Nifty task ${task.id} has no assigned users with active integrations.`);
        return;
    }

    // 3. Prepare the data and upsert the task for all relevant users.
    const taskDataForUpsert = usersToSync.map((user) => ({
        name: task.name,
        description: JSON.stringify(toTiptap(task.description)),
        workspace_id: user.workspace_id,
        integration_source: 'nifty',
        external_id: task.id,
        external_data: task,
        host: 'https://nifty.pm',
        assignee: user.user_id,
        creator: user.user_id,
        status: task.completed ? 'completed' : 'pending',
    }));

    const { error: upsertError } = await supabase.from('tasks').upsert(taskDataForUpsert, {
        onConflict: 'integration_source, external_id, assignee',
    });

    if (upsertError) {
        throw new Error(`Failed to upsert tasks: ${upsertError.message}`);
    }
}

// Main Cloudflare Worker entry point
export async function onRequestPost(context) {
    try {
        const payload = await context.request.json();
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const event = payload.eventType;
        const task = payload.data;

        console.log(task);

        if (!event || !task || !task.id) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid webhook payload' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        // --- Handle both created and updated events with the same logic ---
        if (event === 'taskCreated' || event === 'taskUpdated') {
            await handleTaskEvent(supabase, task);
            console.log(`Successfully processed ${event} for Nifty task ${task.id}`);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Handle task taskDeleted events
        if (event === 'taskDeleted') {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'nifty')
                .eq('external_id', task.id);

            if (error) {
                console.error('Error deleting Nifty task from database:', error);
                return new Response(
                    JSON.stringify({ success: false, error: 'Failed to delete task' }),
                    {
                        status: 500,
                    },
                );
            }

            console.log(`Successfully processed ${event} for Nifty task ${task.id}`);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: false, error: 'Unsupported event type' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error processing Nifty webhook:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
