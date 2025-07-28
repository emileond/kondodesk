import { createClient } from '@supabase/supabase-js';

// Helper function to convert plain text to a basic Tiptap/JSON format
function toTiptap(text) {
    if (!text) return null;
    return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    };
}

/**
 * Handles the reconciliation logic for a Nifty task event.
 * It ensures that a task exists in your app for every assigned user
 * who has the Nifty integration, and removes it for those who don't.
 */
async function handleTaskEvent(supabase, task) {
    // 1. Get Nifty assignee IDs from the payload.
    // Assumes task.assignees is an array like [{ member: 'nifty-user-id-123' }]
    const niftyAssigneeIds = task.assignees?.map((a) => a.member).filter(Boolean) || [];

    // 2. Find which of these assignees have an active integration in your app.
    // This maps Nifty user IDs to your internal user and workspace IDs.
    const { data: userMappings, error: mappingError } = await supabase
        .from('user_integrations')
        .select('user_id, workspace_id')
        .eq('integration_source', 'nifty')
        .in('external_data->>id', niftyAssigneeIds); // Query based on your JSONB structure

    if (mappingError) throw new Error(`Failed to map Nifty users: ${mappingError.message}`);

    const usersWhoShouldHaveTask = userMappings || [];
    const internalUserIdsToKeep = usersWhoShouldHaveTask.map((u) => u.user_id);

    // 3. Get all users in Weekfuse who are currently assigned to this external task.
    const { data: existingTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('assignee')
        .eq('integration_source', 'nifty')
        .eq('external_id', task.id.toString());

    if (fetchError) throw new Error(`Failed to fetch existing tasks: ${fetchError.message}`);

    const currentInternalUserIds = existingTasks.map((t) => t.assignee);

    // 4. Reconcile the lists to determine who to upsert and who to delete.
    const userIdsToRemove = currentInternalUserIds.filter(
        (id) => !internalUserIdsToKeep.includes(id),
    );

    // --- Prepare Database Operations ---
    const promises = [];

    // A) UPSERT tasks for all users who should have it.
    // This handles both new assignments (insert) and existing ones (update).
    if (usersWhoShouldHaveTask.length > 0) {
        const taskDataForUpsert = usersWhoShouldHaveTask.map((user) => ({
            name: task.title,
            description: JSON.stringify(toTiptap(task.description)),
            workspace_id: user.workspace_id,
            integration_source: 'nifty',
            external_id: task.id.toString(),
            external_data: task,
            host: 'https://nifty.pm',
            assignee: user.user_id,
            creator: user.user_id, // Assigning the task to the user as creator
            status: task.completed ? 'completed' : 'pending',
        }));

        promises.push(
            supabase.from('tasks').upsert(taskDataForUpsert, {
                // This constraint is crucial for your 1-task-per-user model
                onConflict: 'integration_source, external_id, assignee',
            }),
        );
    }

    // B) DELETE tasks for users who were unassigned in Nifty.
    if (userIdsToRemove.length > 0) {
        promises.push(
            supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'nifty')
                .eq('external_id', task.id.toString())
                .in('assignee', userIdsToRemove),
        );
    }

    // Execute all operations concurrently
    const results = await Promise.all(promises);

    // Check for errors in the results
    results.forEach((result) => {
        if (result.error) {
            console.error('A database operation failed during reconciliation:', result.error);
            // You might want to add more robust error handling/retries here
        }
    });
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
            const { , error } = await supabase
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
