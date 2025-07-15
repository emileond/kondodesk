import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Asana integration
export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id } = body;

        if (!id) {
            return Response.json({ success: false, error: 'Missing id' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const { data, error } = await supabase
            .from('user_integrations')
            .select('access_token, user_id, workspace_id')
            .eq('type', 'asana')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Asana integration from database:', error);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        const { user_id, workspace_id } = data;

        // Delete the token from the database
        const { error: deleteError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('type', 'asana')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Asana integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'asana')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Asana integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Asana OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id, state } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Exchange code for access token
        const tokenData = await ky
            .post('https://app.asana.com/-/oauth_token', {
                json: {
                    client_id: context.env.ASANA_CLIENT_ID,
                    client_secret: context.env.ASANA_CLIENT_SECRET,
                    code: code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/asana',
                    grant_type: 'authorization_code',
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .json();

        const { access_token, refresh_token, expires_in } = await tokenData;

        if (!access_token) {
            console.error('Asana token exchange error:', tokenData);
            return Response.json(
                {
                    success: false,
                    error: tokenData.error || 'Failed to get access token',
                },
                { status: 400 },
            );
        }

        // Calculate expires_at if expires_in is available
        let expires_at = null;
        if (expires_in) {
            expires_at = calculateExpiresAt(expires_in - 600);
        }

        // Save the access token in Supabase
        const { data: upsertData, error: updateError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'asana',
                access_token: access_token,
                refresh_token: refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: { syncStatus: 'prompt' },
            })
            .select('id')
            .single();

        const integration_id = upsertData.id;

        if (updateError) {
            console.error('Supabase update error:', updateError);
            return Response.json(
                {
                    success: false,
                    error: 'Failed to save integration data',
                },
                { status: 500 },
            );
        }

        // Fetch user data from Asana API
        try {
            const userData = await ky
                .get('https://app.asana.com/api/1.0/users/me', {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Accept: 'application/json',
                    },
                })
                .json();

            // Update user_integrations with the user data
            const { error: userDataUpdateError } = await supabase
                .from('user_integrations')
                .update({ external_data: userData.data })
                .eq('type', 'asana')
                .eq('id', integration_id);

            if (userDataUpdateError) {
                console.error('Error updating user data:', userDataUpdateError);
            } else {
                console.log('User data updated successfully');
            }
        } catch (userDataError) {
            console.error('Error fetching user data:', userDataError);
            // Continue with the flow even if user data fetch fails
        }

        // Fetch workspaces the user has access to
        const workspacesResponse = await ky
            .get('https://app.asana.com/api/1.0/workspaces', {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: 'application/json',
                },
            })
            .json();

        const workspaces = workspacesResponse.data || [];
        let allUpsertPromises = [];
        let allTasksData = [];

        // Process each workspace
        for (const workspace of workspaces) {
            try {
                // Fetch tasks assigned to the current user in this workspace
                const tasksResponse = await ky
                    .get(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${workspace.gid}&completed_since=now&opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url`, {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            Accept: 'application/json',
                        },
                    })
                    .json();

                const tasks = tasksResponse.data || [];

                // Get project_id from integration config if available
                const project_id = null; // Will be set from config later

                const upsertPromises = tasks.map((task) => {
                    return supabase.from('tasks').upsert(
                        {
                            name: task.name,
                            description: task.notes || null,
                            workspace_id,
                            integration_source: 'asana',
                            external_id: task.gid,
                            external_data: task,
                            host: 'https://app.asana.com',
                            assignee: user_id,
                            creator: user_id,
                            project_id: project_id,
                        },
                        {
                            onConflict: 'integration_source, external_id, host, workspace_id',
                        },
                    );
                });

                // Add the promises and tasks to our arrays for later processing
                allUpsertPromises = [...allUpsertPromises, ...upsertPromises];
                allTasksData = [...allTasksData, ...tasks];
            } catch (workspaceError) {
                console.error(`Error processing workspace ${workspace.gid}:`, workspaceError);
                // Continue with other workspaces even if one fails
            }
        }

        // Wait for all upsert operations to complete
        if (allUpsertPromises.length > 0) {
            const results = await Promise.all(allUpsertPromises);

            results.forEach((result, index) => {
                if (result.error) {
                    console.error(
                        `Upsert error for task ${allTasksData[index].gid}:`,
                        result.error,
                    );
                } else {
                    console.log(`Task ${allTasksData[index].gid} imported successfully`);
                }
            });
        }

        // Set up webhooks for each workspace
        for (const workspace of workspaces) {
            try {
                // Create webhook for task events
                await ky.post('https://app.asana.com/api/1.0/webhooks', {
                    json: {
                        data: {
                            resource: workspace.gid,
                            target: 'https://weekfuse.com/webhooks/asana',
                            filters: [
                                {
                                    resource_type: 'task',
                                    action: 'added'
                                },
                                {
                                    resource_type: 'task',
                                    action: 'changed'
                                }
                            ]
                        }
                    },
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                    },
                });

                console.log(`Webhook registered successfully for workspace ${workspace.gid}`);
            } catch (webhookError) {
                console.error(
                    `Error registering webhook for workspace ${workspace.gid}:`,
                    webhookError,
                );
                // Continue with other workspaces even if webhook registration fails for one
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Asana auth flow:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}