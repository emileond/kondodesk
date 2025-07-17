import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Microsoft To Do integration
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
            .eq('type', 'microsoft_todo')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Microsoft To Do integration from database:', error);
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
            .eq('type', 'microsoft_todo')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Microsoft To Do integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'microsoft_todo')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Microsoft To Do integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Microsoft To Do OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Exchange code for access token
        const tokenData = await ky
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                body: new URLSearchParams({
                    client_id: context.env.MICROSOFT_TODO_CLIENT_ID,
                    client_secret: context.env.MICROSOFT_TODO_CLIENT_SECRET,
                    code: code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/microsoft_todo',
                    grant_type: 'authorization_code',
                    scope: 'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read offline_access',
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            })
            .json();

        const { access_token, refresh_token, expires_in } = await tokenData;

        if (!access_token || !refresh_token) {
            console.error('Microsoft To Do token exchange error:', tokenData);
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
                type: 'microsoft_todo',
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

        // Fetch user data from Microsoft Graph API
        try {
            const userData = await ky
                .get('https://graph.microsoft.com/v1.0/me', {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Accept: 'application/json',
                    },
                })
                .json();

            // Update user_integrations with the user data
            const { error: userDataUpdateError } = await supabase
                .from('user_integrations')
                .update({ external_data: userData })
                .eq('type', 'microsoft_todo')
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

        // Fetch task lists
        const taskLists = await ky
            .get('https://graph.microsoft.com/v1.0/me/todo/lists', {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: 'application/json',
                },
            })
            .json();

        let allUpsertPromises = [];
        let allTasksData = [];

        // Fetch tasks from each list
        for (const list of taskLists.value || []) {
            try {
                const tasksResponse = await ky
                    .get(`https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks`, {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            Accept: 'application/json',
                        },
                    })
                    .json();

                const tasks = tasksResponse.value || [];

                // Filter for incomplete tasks only
                const incompleteTasks = tasks.filter(task => task.status !== 'completed');

                if (incompleteTasks.length > 0) {
                    const upsertPromises = incompleteTasks.map((task) => {
                        return supabase.from('tasks').upsert(
                            {
                                name: task.title,
                                description: task.body?.content || null,
                                workspace_id,
                                integration_source: 'microsoft_todo',
                                external_id: task.id,
                                external_data: { ...task, listId: list.id, listName: list.displayName },
                                host: 'https://to-do.office.com',
                                assignee: user_id,
                                creator: user_id,
                            },
                            {
                                onConflict: 'integration_source, external_id, host, workspace_id',
                            },
                        );
                    });

                    allUpsertPromises = [...allUpsertPromises, ...upsertPromises];
                    allTasksData = [...allTasksData, ...incompleteTasks];
                }
            } catch (listError) {
                console.error(`Error fetching tasks for list ${list.id}:`, listError);
                // Continue with other lists even if one fails
            }
        }

        // Wait for all upsert operations to complete
        if (allUpsertPromises.length > 0) {
            const results = await Promise.all(allUpsertPromises);

            results.forEach((result, index) => {
                if (result.error) {
                    console.error(
                        `Upsert error for task ${allTasksData[index].id}:`,
                        result.error,
                    );
                } else {
                    console.log(`Task ${allTasksData[index].id} imported successfully`);
                }
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Microsoft To Do auth flow:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}