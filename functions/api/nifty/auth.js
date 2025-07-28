import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Nifty integration
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
            .eq('type', 'nifty')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Nifty integration from database:', error);
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
            .eq('type', 'nifty')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Nifty integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'nifty')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Nifty integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Nifty OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const credentials = `${context.env.NIFTY_CLIENT_ID}:${context.env.NIFTY_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        // 1. Exchange code for access token
        const tokenResponse = await ky
            .post('https://openapi.niftypm.com/oauth/token', {
                json: {
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/nifty',
                },
                headers: {
                    authorization: encodedCredentials,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            })
            .json();

        const tokenData = await tokenResponse;

        console.log(tokenData);

        if (tokenData.error || !tokenData.access_token) {
            console.error('Nifty token exchange error:', tokenData);
            return Response.json(
                { success: false, error: 'Failed to get Nifty access token' },
                { status: 500 },
            );
        }

        // 2. Save the initial integration data
        const expires_at = tokenData.expires_in
            ? calculateExpiresAt(tokenData.expires_in - 600)
            : null;
        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'nifty',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            expires_at,
            config: { syncStatus: 'prompt' },
        });

        if (upsertError) throw new Error('Failed to save integration data');

        // 3. Process all assigned tasks using Nifty API
        console.log('Starting Nifty initial task sync...');
        const DB_BATCH_SIZE = 50;
        let hasMore = true;
        let offset = 0;

        // Get user's assigned tasks from Nifty
        while (hasMore) {
            console.log(`Fetching tasks from offset: ${offset}`);

            // Get a page of tasks from Nifty
            const tasksResponse = await ky
                .get('https://openapi.niftypm.com/api/v1.0/tasks', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                        Accept: 'application/json',
                    },
                    searchParams: {
                        completed: false,
                        limit: DB_BATCH_SIZE,
                        offset: offset,
                    },
                })
                .json();

            console.log(tasksResponse);

            const tasks = tasksResponse.tasks || [];

            if (tasks.length > 0) {
                // Process the fetched tasks
                const upsertPromises = tasks.map((task) => {
                    // Return the promise from the upsert call
                    return supabase.from('tasks').upsert(
                        {
                            name: task.name,
                            description: task.description ? JSON.stringify(task.description) : null,
                            workspace_id,
                            integration_source: 'nifty',
                            external_id: task.id,
                            external_data: task,
                            host: 'https://nifty.pm',
                            assignee: user_id,
                            creator: user_id,
                        },
                        {
                            onConflict: 'integration_source, external_id, host, workspace_id',
                        },
                    );
                });

                // Wait for all the upsert promises to resolve
                const results = await Promise.all(upsertPromises);

                // Optionally, check for errors after all operations are complete
                results.forEach((result, index) => {
                    if (result.error) {
                        console.error(
                            `Error saving task ${tasks[index].id} to database:`,
                            result.error,
                        );
                    }
                });
            }

            // Update loop control variables for the next iteration
            hasMore = tasksResponse.hasMore;
            offset += DB_BATCH_SIZE;
        }

        console.log('Nifty initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Nifty auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
