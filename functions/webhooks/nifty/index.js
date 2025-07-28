import { createClient } from '@supabase/supabase-js';

// Helper function to convert plain text to a basic Tiptap/JSON format
function toTiptap(text) {
    if (!text) return null;
    return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    };
}

async function handleTaskCreation(supabase, task) {
    const niftyAssigneeIds = task.assignees?.map((a) => a).filter(Boolean) || [];
    if (niftyAssigneeIds.length === 0) {
        console.log(`[Create] Nifty task ${task.id} has no assignees, no action taken.`);
        return;
    }

    const { data: userMappings, error: mappingError } = await supabase
        .from('user_integrations')
        .select('user_id, workspace_id')
        .eq('integration_source', 'nifty')
        .in('external_data->>id', niftyAssigneeIds);

    if (mappingError)
        throw new Error(`[Create] Failed to map Nifty users: ${mappingError.message}`);

    const usersToSync = userMappings || [];
    if (usersToSync.length === 0) {
        console.log(
            `[Create] Nifty task ${task.id} has no assigned users with active integrations.`,
        );
        return;
    }

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

    if (upsertError) throw new Error(`[Create] Failed to upsert tasks: ${upsertError.message}`);
}

async function handleTaskUpdate(supabase, task) {
    // Call the database function you just created
    const { error } = await supabase.rpc('update_nifty_task', {
        p_external_id: task.id,
        p_new_name: task.name,
        p_new_status: task.completedOn ? 'completed' : 'pending',
        p_new_data: task,
    });

    if (error) {
        console.error(`[Update] Failed to update task ${task.id}:`, error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

// Main Cloudflare Worker entry point
export async function onRequestPost(context) {
    try {
        const payload = await context.request.json();
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const event = payload.eventType;
        const task = payload.data;

        if (!event || !task || !task.id) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid webhook payload' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        // --- Route events to the correct handler ---
        if (event === 'taskCreated') {
            await handleTaskCreation(supabase, task);
        } else if (event === 'taskUpdated') {
            await handleTaskUpdate(supabase, task);
        } else if (event === 'taskDeleted') {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'nifty')
                .eq('external_id', task.id);

            if (error)
                throw new Error(`[Delete] Failed to delete task ${task.id}: ${error.message}`);
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Unsupported event type' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        console.log(`Successfully processed ${event} for Nifty task ${task.id}`);
        return new Response(JSON.stringify({ success: true }), {
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
