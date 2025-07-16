import ky from 'ky';
import { createClient } from '@supabase/supabase-js';

// Handle PUT requests for updating Asana tasks
export async function onRequestPut(context) {
    try {
        const { taskId } = context.params;
        const body = await context.request.json();
        const { completed, user_id, workspace_id } = body;

        if (!taskId || completed === undefined || !user_id || !workspace_id) {
            return Response.json(
                { success: false, error: 'Missing required data' },
                { status: 400 },
            );
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the user's Asana integration
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at')
            .eq('type', 'asana')
            .eq('user_id', user_id)
            .eq('workspace_id', workspace_id)
            .eq('status', 'active')
            .single();

        if (integrationError || !integration) {
            console.error('Error fetching Asana integration:', integrationError);
            return Response.json(
                { success: false, error: 'Asana integration not found' },
                { status: 404 },
            );
        }

        // Update the task completion status in Asana
        try {
            await ky.put(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
                json: {
                    data: {
                        completed: completed,
                    },
                },
                headers: {
                    Authorization: `Bearer ${integration.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            // 1. Fetch the current task to get its existing `external_data`
            const { data: existingTask, error: fetchError } = await supabase
                .from('tasks')
                .select('external_data')
                .eq('integration_source', 'asana')
                .eq('external_id', taskId)
                .single();

            if (fetchError) {
                console.error('Could not fetch task from DB to update its JSONB:', fetchError);
                // Don't return an error, since the primary Asana update succeeded
            } else {
                // 2. Modify the JavaScript object in memory
                // This preserves all other data in the JSONB field.
                const updatedExternalData = existingTask.external_data || {};
                updatedExternalData.completed = completed;

                // 3. Send the entire modified object back to Supabase
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({
                        external_data: updatedExternalData,
                    })
                    .eq('external_id', taskId); // Match on the unique external ID

                if (updateError) {
                    console.error('Error updating task in database:', updateError);
                }
            }

            return Response.json({ success: true });
        } catch (asanaError) {
            console.error('Error updating task in Asana:', asanaError);
            return Response.json(
                { success: false, error: 'Failed to update task in Asana' },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error('Error in Asana task update:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}
