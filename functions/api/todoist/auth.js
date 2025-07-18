import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../../../src/utils/dateUtils.js';
import { markdownToTipTap } from '../../../src/utils/editorUtils.js';

// Handle DELETE requests for disconnecting Todoist integration
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
            .eq('type', 'todoist')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Todoist integration from database:', error);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        const { access_token, user_id, workspace_id } = data;

        await ky.delete(
            `https://api.todoist.com/api/v1/access_tokens?client_id=${context.env.TODOIST_CLIENT_ID}&client_secret=${context.env.TODOIST_CLIENT_SECRET}&access_token=${access_token}`,
        );

        // Delete the token from the database
        const { error: deleteError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('type', 'todoist')
            .eq('access_token', access_token);

        if (deleteError) {
            console.error('Error deleting Todoist integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'todoist')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Todoist integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Todoist OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Exchange the authorization code for an access token
        const tokenResponse = await ky
            .post('https://todoist.com/oauth/access_token', {
                json: {
                    client_id: context.env.TODOIST_CLIENT_ID,
                    client_secret: context.env.TODOIST_CLIENT_SECRET,
                    code: code,
                },
            })
            .json();

        const { access_token } = tokenResponse;
        if (!access_token) throw new Error('Failed to obtain Todoist access token');

        const headers = { Authorization: `Bearer ${access_token}` };

        // 2. Get user info and save the initial integration data
        const userInfo = await ky.get('https://api.todoist.com/api/v1/user', { headers }).json();

        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'todoist',
            access_token,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            external_data: userInfo,
            config: { syncStatus: 'prompt' },
        });

        if (upsertError) throw new Error('Failed to save integration data');

        // 3. Fetch and process all tasks with pagination and DB batching
        console.log('Starting Todoist initial task sync...');
        const DB_BATCH_SIZE = 50;
        let nextCursor = null;

        do {
            const queryParams = nextCursor ? `?cursor=${nextCursor}` : '';
            const response = await ky
                .get(`https://api.todoist.com/api/v1/tasks${queryParams}`, { headers })
                .json();
            const pageTasks = response.results || [];

            if (pageTasks.length > 0) {
                // Process the current page of tasks in batches
                for (let i = 0; i < pageTasks.length; i += DB_BATCH_SIZE) {
                    const batch = pageTasks.slice(i, i + DB_BATCH_SIZE);
                    const upsertPromises = batch.map((task) => {
                        const tiptapDescription = task.description
                            ? markdownToTipTap(task.description)
                            : null;
                        return supabase.from('tasks').upsert(
                            {
                                name: task.content,
                                description: tiptapDescription
                                    ? JSON.stringify(tiptapDescription)
                                    : null,
                                workspace_id,
                                integration_source: 'todoist',
                                external_id: task.id.toString(),
                                external_data: task,
                                host: `https://todoist.com/app/task/${task.id}`,
                                assignee: user_id,
                                creator: user_id,
                            },
                            { onConflict: 'integration_source, external_id, host, workspace_id' },
                        );
                    });
                    await Promise.all(upsertPromises);
                }
            }

            nextCursor = response.next_cursor;
        } while (nextCursor);

        console.log('Todoist initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Todoist auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
