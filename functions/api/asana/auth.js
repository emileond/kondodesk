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

// Handle POST requests for initiating Asana OAuth flow and setting up webhooks
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Exchange authorization code for an access token
        const tokenResponse = await ky.post('https://app.asana.com/-/oauth_token', {
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: context.env.ASANA_CLIENT_ID,
                client_secret: context.env.ASANA_CLIENT_SECRET,
                redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/asana',
                code: code,
            }),
        });

        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token, expires_in } = tokenData;

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

        // 2. Save the initial integration data to Supabase to get a unique ID
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;

        const { data: upsertData, error: upsertError } = await supabase
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

        if (upsertError) {
            console.error('Supabase upsert error:', upsertError);
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        }

        const integration_id = upsertData.id;

        // 3. Fetch user data from Asana API to get their GID (Global ID)
        const userResponse = await ky.get('https://app.asana.com/api/1.0/users/me', {
            headers: {
                Authorization: `Bearer ${access_token}`,
                Accept: 'application/json',
            },
        });
        const userData = await userResponse.json();
        const userGid = userData?.data?.gid;

        if (!userGid) {
            // return an error
            return Response.json(
                { success: false, error: 'Failed to get user data' },
                { status: 400 },
            );
        }

        // Update user_integrations with the external user data
        await supabase
            .from('user_integrations')
            .update({ external_data: userData.data })
            .eq('id', integration_id);

        // 4. Initial Task Sync
        const workspacesResponse = await ky
            .get('https://app.asana.com/api/1.0/workspaces', {
                headers: { Authorization: `Bearer ${access_token}` },
            })
            .json();

        const workspaces = workspacesResponse.data || [];
        const allUpsertPromises = [];

        for (const workspace of workspaces) {
            const tasksResponse = await ky
                .get(
                    `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${workspace.gid}&completed_since=now&opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url`,
                    { headers: { Authorization: `Bearer ${access_token}` } },
                )
                .json();

            const tasks = tasksResponse.data || [];
            tasks.forEach((task) => {
                const upsertPromise = supabase.from('tasks').upsert(
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
                        project_id: null,
                    },
                    {
                        onConflict: 'integration_source, external_id, host, workspace_id',
                    },
                );
                allUpsertPromises.push(upsertPromise);
            });
        }
        await Promise.allSettled(allUpsertPromises);
        console.log('Initial task sync completed.');

        // 5. Set up webhooks for each workspace on the user's task list
        for (const workspace of workspaces) {
            try {
                // Find the user's task list GID for this specific workspace
                const userTaskListResponse = await ky
                    .get(
                        `https://app.asana.com/api/1.0/users/${userGid}/user_task_lists?workspace=${workspace.gid}`,
                        { headers: { Authorization: `Bearer ${access_token}` } },
                    )
                    .json();

                const userTaskListGid = userTaskListResponse.data?.gid;
                if (!userTaskListGid) {
                    console.warn(
                        `Could not find user task list in workspace ${workspace.gid}. Skipping webhook setup.`,
                    );
                    continue;
                }

                // Create the webhook using the correct resource and a unique target URL
                await ky.post('https://app.asana.com/api/1.0/webhooks', {
                    json: {
                        data: {
                            resource: userTaskListGid,
                            target: `https://weekfuse.com/webhooks/asana?integration_id=${integration_id}`,
                            filters: [
                                { resource_type: 'task', action: 'added' },
                                { resource_type: 'task', action: 'changed' },
                                { resource_type: 'task', action: 'deleted' },
                            ],
                        },
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
                    await webhookError.response?.json().catch(() => webhookError.message),
                );
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Asana auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
