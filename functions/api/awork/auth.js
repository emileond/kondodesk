import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Awork integration
export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id } = body;

        if (!id) {
            return Response.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 },
            );
        }
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get user_id before deleting the integration
        const { data, error } = await supabase
            .from('user_integrations')
            .select('user_id, workspace_id')
            .eq('type', 'awork')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Awork integration from database:', error);
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
            .eq('type', 'awork')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Awork integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'awork')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Awork integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Awork OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const credentials = `${context.env.AWORK_CLIENT_ID}:${context.env.AWORK_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        // 1. Exchange code for access token
        const tokenData = await ky
            .post('https://api.awork.com/api/v1/accounts/token', {
                // Use URLSearchParams to send data as application/x-www-form-urlencoded
                body: new URLSearchParams({
                    redirect_uri: `https://weekfuse.com/integrations/oauth/callback/awork`,
                    grant_type: 'authorization_code',
                    code: code,
                }),
                headers: {
                    Authorization: `Basic ${encodedCredentials}`,
                },
            })
            .json();

        if (tokenData.error || !tokenData.access_token) {
            console.error('Awork token exchange error:', tokenData);
            return Response.json(
                { success: false, error: 'Failed to get access token' },
                { status: 500 },
            );
        }

        const aworkUserResponse = await ky
            .get('https://api.awork.com/api/v1/users/me', {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: 'application/json',
                },
            })
            .json();

        const aworkUserId = aworkUserResponse.id;

        if (!aworkUserId) {
            console.error('Awork user ID not found in response:', aworkUserResponse);
            return Response.json(
                { success: false, error: 'Failed to get Nifty user ID' },
                { status: 500 },
            );
        }

        // 2. Save the initial integration data
        const expires_at = tokenData.expires_in
            ? calculateExpiresAt(tokenData.expires_in - 600)
            : null;

        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'awork',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            expires_at,
            config: { syncStatus: 'prompt' },
            external_data: aworkUserResponse,
        });

        if (upsertError) {
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        }

        // 3. Process all assigned tasks using pagination and batching
        console.log('Starting Awork initial task sync...');
        const DB_BATCH_SIZE = 50;

        // Get user's tasks from Awork API
        let page = 1;
        let hasMore = true;
        const filterExpression = "(taskStatus/type ne 'done' and taskStatus/type ne 'canceled')";

        while (hasMore) {
            try {
                const tasksResponse = await ky
                    .get(`https://api.awork.com/api/v1/users/${aworkUserId}/assignedtasks`, {
                        searchParams: {
                            page: page,
                            pageSize: 100,
                            filterby: filterExpression,
                            orderby: 'createdOn desc',
                        },
                        headers: {
                            Authorization: `Bearer ${tokenData.access_token}`,
                            Accept: 'application/json',
                        },
                    })
                    .json();

                const tasks = tasksResponse.data || [];

                if (tasks.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process tasks in batches
                for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                    const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                    const upsertPromises = batch.map((task) => {
                        // Only import incomplete tasks
                        if (task.taskStatusType === 'done') {
                            return Promise.resolve();
                        }

                        return supabase.from('tasks').upsert(
                            {
                                name: task.name,
                                description: task.description
                                    ? JSON.stringify({
                                          type: 'doc',
                                          content: [
                                              {
                                                  type: 'paragraph',
                                                  content: [
                                                      {
                                                          type: 'text',
                                                          text: task.description,
                                                      },
                                                  ],
                                              },
                                          ],
                                      })
                                    : null,
                                workspace_id,
                                integration_source: 'awork',
                                external_id: task.id.toString(),
                                external_data: task,
                                host: 'https://app.awork.com',
                                assignee: user_id,
                                creator: user_id,
                            },
                            {
                                onConflict: 'integration_source, external_id, host, workspace_id',
                            },
                        );
                    });
                    await Promise.all(upsertPromises);
                }

                page++;

                // Check if we have more pages
                if (tasks.length < 100) {
                    hasMore = false;
                }
            } catch (apiError) {
                console.error('Error fetching tasks from Awork:', apiError);
                hasMore = false;
            }
        }

        console.log('Awork initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Awork auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
