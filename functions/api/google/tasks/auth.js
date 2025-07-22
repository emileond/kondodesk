import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Google Tasks integration
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
            .eq('type', 'google_tasks')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Google Tasks integration from database:', error);
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
            .eq('type', 'google_tasks')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Google Tasks integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'google_tasks')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Google Tasks integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id, state } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Verify state parameter to prevent CSRF attacks
        if (state) {
            // In a real implementation, you'd verify the state parameter
            // For now, we'll just log it
            console.log('State parameter received:', state);
        }

        // 1. Exchange code for access token
        const tokenResponse = await ky
            .post('https://oauth2.googleapis.com/token', {
                json: {
                    client_id: context.env.GOOGLE_OAUTH_CLIENT_ID,
                    client_secret: context.env.GOOGLE_OAUTH_CLIENT_SECRET,
                    code: code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/google_tasks',
                    grant_type: 'authorization_code',
                },
            })
            .json();

        const { access_token, refresh_token, expires_in } = await tokenResponse;

        if (!access_token) {
            console.error('Google Tasks token exchange error:', tokenResponse);
            throw new Error(tokenResponse.error || 'Failed to get Google Tasks access token');
        }

        // 2. Save the initial integration data
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;
        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'google_tasks',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: {},
            })
            .select('id')
            .single();

        if (upsertError) throw new Error('Failed to save integration data');
        const integration_id = upsertData.id;

        // 3. Fetch user profile information
        try {
            const headers = { Authorization: `Bearer ${access_token}` };
            const userProfile = await ky
                .get('https://www.googleapis.com/oauth2/v2/userinfo', { headers })
                .json();

            await supabase
                .from('user_integrations')
                .update({ external_data: userProfile })
                .eq('id', integration_id);
        } catch (userDataError) {
            console.error('Could not fetch Google user data:', userDataError);
        }

        // 4. Fetch and import tasks from all task lists
        const headers = { Authorization: `Bearer ${access_token}` };

        try {
            // Get all task lists
            const taskListsResponse = await ky
                .get('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers })
                .json();

            const taskLists = taskListsResponse.items || [];
            const DB_BATCH_SIZE = 50;

            for (const taskList of taskLists) {
                try {
                    console.log(`Processing Google Tasks list: ${taskList.title} (${taskList.id})`);

                    // Get tasks from this list
                    const tasksResponse = await ky
                        .get(`https://tasks.googleapis.com/tasks/v1/lists/${taskList.id}/tasks`, {
                            headers,
                            searchParams: {
                                showCompleted: false,
                                showDeleted: false,
                                maxResults: 100,
                            },
                        })
                        .json();

                    const tasks = tasksResponse.items || [];

                    // Process tasks in batches
                    for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                        const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.title || 'Untitled Task',
                                    description: task.notes || null,
                                    workspace_id,
                                    integration_source: 'google_tasks',
                                    external_id: task.id,
                                    external_data: {
                                        ...task,
                                        taskListId: taskList.id,
                                        taskListTitle: taskList.title,
                                    },
                                    host: 'tasks.google.com',
                                    assignee: user_id,
                                    creator: user_id,
                                    due_date: task.due ? new Date(task.due).toISOString() : null,
                                },
                                {
                                    onConflict:
                                        'integration_source, external_id, host, workspace_id',
                                },
                            );
                        });
                        await Promise.all(upsertPromises);
                    }

                    console.log(`Processed ${tasks.length} tasks from list ${taskList.title}`);
                } catch (listError) {
                    console.error(`Failed to process task list ${taskList.id}:`, listError);
                }
            }
        } catch (importError) {
            console.error('Error importing Google Tasks:', importError);
            // Don't fail the entire integration if import fails
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Google Tasks auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
