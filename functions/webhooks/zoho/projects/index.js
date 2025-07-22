import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Parse the webhook payload
        const payload = await context.request.json();

        // Extract the webhook event type and task data
        const eventType = payload.event_type;
        const task = payload.task;
        const project = payload.project;
        const user = payload.user;

        if (!eventType || !task || !project || !user) {
            return Response.json(
                { success: false, error: 'Invalid webhook payload' },
                { status: 400 },
            );
        }

        // Handle different webhook events
        if (eventType === 'task_created') {
            // Get the user integration to find the workspace_id and config
            const { data: integrationData, error: integrationError } = await supabase
                .from('user_integrations')
                .select('workspace_id, user_id, config')
                .eq('type', 'zoho_projects')
                .eq('status', 'active')
                .eq('external_data->>id', user.id)
                .single();

            if (integrationError || !integrationData) {
                console.error(
                    'Error fetching integration data:',
                    integrationError || 'No matching integration found',
                );
                return Response.json(
                    { success: false, error: 'Integration not found' },
                    { status: 404 },
                );
            }

            // Use the matching integration
            const workspace_id = integrationData.workspace_id;
            const user_id = integrationData.user_id;

            // Get project_id from integration config if available
            const project_id = integrationData.config?.project_id || null;

            // Upsert the task in the database
            const { error: insertError } = await supabase.from('tasks').insert({
                name: task.name,
                description: task.description || null,
                workspace_id,
                integration_source: 'zoho_projects',
                external_id: task.id,
                external_data: task,
                host: `https://projectsapi.zoho.com/restapi/projects/${project.id}`,
                assignee: user_id,
                creator: user_id,
                project_id: project_id,
            });

            if (insertError) {
                console.error(`Insert error for task ${task.id}:`, insertError);
                return Response.json(
                    { success: false, error: 'Failed to create task' },
                    { status: 500 },
                );
            }

            console.log(`Task ${task.id} created successfully`);
            return Response.json({ success: true });
        }

        if (eventType === 'task_updated') {
            // Get the integration config to find the project_id
            const { data: integration, error: integrationError } = await supabase
                .from('user_integrations')
                .select('workspace_id, user_id, config')
                .eq('type', 'zoho_projects')
                .eq('status', 'active')
                .eq('external_data->>id', user.id)
                .single();

            if (integrationError) {
                console.error(
                    `Error fetching integration for Zoho Projects task ${task.id}:`,
                    integrationError,
                );
                // Continue without project_id if integration not found
            }

            // Get project_id from integration config if available
            const project_id = integration?.config?.project_id || null;

            // Update the task in the database
            const { data: updateData, error: updateError } = await supabase
                .from('tasks')
                .update({
                    name: task.name,
                    description: task.description || null,
                    integration_source: 'zoho_projects',
                    external_id: task.id,
                    external_data: task,
                    project_id: project_id,
                })
                .eq('integration_source', 'zoho_projects')
                .eq('external_id', task.id)
                .eq('host', `https://projectsapi.zoho.com/restapi/projects/${project.id}`)
                .select();

            if (updateError) {
                console.error(`Update error for task ${task.id}:`, updateError);
                return Response.json(
                    { success: false, error: 'Failed to update task' },
                    { status: 500 },
                );
            }

            console.log(`Task ${task.id} updated successfully`);
            return Response.json({ success: true });
        }

        if (eventType === 'task_deleted') {
            // Delete the task from the database
            const { error: deleteError } = await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'zoho_projects')
                .eq('external_id', task.id)
                .eq('host', `https://projectsapi.zoho.com/restapi/projects/${project.id}`);

            if (deleteError) {
                console.error(`Delete error for task ${task.id}:`, deleteError);
                return Response.json(
                    { success: false, error: 'Failed to delete task' },
                    { status: 500 },
                );
            }

            console.log(`Task ${task.id} deleted successfully`);
            return Response.json({ success: true });
        }

        // If we reach here, the webhook event type is not supported
        return Response.json(
            { success: false, error: 'Unsupported webhook event' },
            { status: 400 },
        );
    } catch (error) {
        console.error('Error processing Zoho Projects webhook:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}