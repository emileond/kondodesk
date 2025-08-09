import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Parse the webhook payload
        const payload = await context.request.json();

        // Microsoft Graph webhooks send an array of notifications
        const notifications = payload.value || [];

        if (!notifications.length) {
            return Response.json(
                { success: false, error: 'No notifications in payload' },
                { status: 400 },
            );
        }

        // Process each notification
        for (const notification of notifications) {
            try {
                // Extract notification data
                const { changeType, resource, resourceData } = notification;

                if (!changeType || !resource) {
                    console.log('Skipping notification with missing changeType or resource');
                    continue;
                }

                // Handle different change types
                if (changeType === 'created' || changeType === 'updated') {
                    // Extract task ID and list ID from resource path
                    // Resource format: /me/todo/lists/{listId}/tasks/{taskId}
                    const resourceParts = resource.split('/');
                    const listIdIndex = resourceParts.indexOf('lists') + 1;
                    const taskIdIndex = resourceParts.indexOf('tasks') + 1;

                    if (listIdIndex <= 0 || taskIdIndex <= 0) {
                        console.log(
                            'Could not extract listId or taskId from resource path:',
                            resource,
                        );
                        continue;
                    }

                    const listId = resourceParts[listIdIndex];
                    const taskId = resourceParts[taskIdIndex];

                    // Find the integration that matches this subscription
                    // Note: In a real implementation, you'd need to store subscription IDs
                    // and map them to user integrations
                    const { data: integrations, error: integrationError } = await supabase
                        .from('user_integrations')
                        .select('workspace_id, user_id, config, access_token')
                        .eq('type', 'microsoft_todo')
                        .eq('status', 'active');

                    if (integrationError || !integrations || integrations.length === 0) {
                        console.error(
                            'Error fetching Microsoft To Do integrations:',
                            integrationError,
                        );
                        continue;
                    }

                    // For now, we'll process for all active integrations
                    // In a production system, you'd want to match the specific user
                    for (const integration of integrations) {
                        const { workspace_id, user_id, config } = integration;

                        // Get project_id from integration config if available
                        const project_id = config?.project_id || null;

                        if (changeType === 'created') {
                            // For created tasks, we need to fetch the full task data
                            // This would require making an API call with the stored access token
                            // For now, we'll create a placeholder task
                            const { error: insertError } = await supabase.from('tasks').insert({
                                name: resourceData?.title || 'Microsoft To Do Task',
                                description: resourceData?.body?.content || null,
                                workspace_id,
                                integration_source: 'microsoft_todo',
                                external_id: taskId,
                                external_data: {
                                    ...resourceData,
                                    listId: listId,
                                    webhookCreated: true,
                                },
                                host: 'https://to-do.office.com',
                                assignee: user_id,
                                creator: user_id,
                                project_id: project_id,
                            });

                            if (insertError) {
                                console.error(`Insert error for task ${taskId}:`, insertError);
                            } else {
                                console.log(`Task ${taskId} created successfully via webhook`);
                            }
                        } else if (changeType === 'updated') {
                            // Update existing task
                            const { data: updateData, error: updateError } = await supabase
                                .from('tasks')
                                .update({
                                    name: resourceData?.title || 'Microsoft To Do Task',
                                    description: resourceData?.body?.content || null,
                                    external_data: {
                                        ...resourceData,
                                        listId: listId,
                                        webhookUpdated: true,
                                    },
                                    project_id: project_id,
                                })
                                .eq('integration_source', 'microsoft_todo')
                                .eq('external_id', taskId)
                                .eq('workspace_id', workspace_id)
                                .select();

                            if (updateError) {
                                console.error(`Update error for task ${taskId}:`, updateError);
                            } else {
                                console.log(`Task ${taskId} updated successfully via webhook`);
                            }
                        }
                    }
                } else if (changeType === 'deleted') {
                    // Handle task deletion
                    const resourceParts = resource.split('/');
                    const listIdIndex = resourceParts.indexOf('lists') + 1;
                    const taskIdIndex = resourceParts.indexOf('tasks') + 1;

                    if (listIdIndex > 0 && taskIdIndex > 0) {
                        const taskId = resourceParts[taskIdIndex];

                        // Delete the task from our database
                        const { error: deleteError } = await supabase
                            .from('tasks')
                            .delete()
                            .eq('integration_source', 'microsoft_todo')
                            .eq('external_id', taskId);

                        if (deleteError) {
                            console.error(`Delete error for task ${taskId}:`, deleteError);
                        } else {
                            console.log(`Task ${taskId} deleted successfully via webhook`);
                        }
                    }
                }
            } catch (notificationError) {
                console.error('Error processing notification:', notificationError);
                // Continue processing other notifications
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error processing Microsoft To Do webhook:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle GET requests for webhook validation (Microsoft Graph requirement)
export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const validationToken = url.searchParams.get('validationToken');

        if (validationToken) {
            // Microsoft Graph sends a validation token that we need to return
            return new Response(validationToken, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain',
                },
            });
        }

        return Response.json(
            { success: false, error: 'Missing validation token' },
            { status: 400 },
        );
    } catch (error) {
        console.error('Error handling Microsoft To Do webhook validation:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}
