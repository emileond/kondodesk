import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../../../src/utils/dateUtils.js';
import { markdownToTipTap } from '../../../src/utils/editorUtils.js';

// Handle POST requests for initiating ClickUp OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Exchange code for access token
        const tokenResponse = await ky
            .post('https://api.clickup.com/api/v2/oauth/token', {
                json: {
                    client_id: context.env.CLICKUP_CLIENT_ID,
                    client_secret: context.env.CLICKUP_CLIENT_SECRET,
                    code: code,
                },
            })
            .json();

        const { access_token } = await tokenResponse;

        if (!access_token) {
            console.error('ClickUp token exchange error:', tokenResponse);
            throw new Error(tokenResponse.error || 'Failed to get ClickUp access token');
        }

        const headers = { Authorization: `Bearer ${access_token}` };

        // 2. Save the initial integration data
        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'clickup',
            access_token: access_token,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            config: { syncStatus: 'prompt' },
        });

        if (upsertError) throw new Error('Failed to save integration data');

        // 3. Fetch user and team data
        const userData = await ky.get('https://api.clickup.com/api/v2/user', { headers }).json();
        const teamsData = await ky.get('https://api.clickup.com/api/v2/team', { headers }).json();

        const clickUpUserId = userData.user.id;
        const teams = teamsData.teams || [];

        if (teams.length === 0) {
            console.log('No ClickUp teams found for this user.');
            return Response.json({
                success: true,
                message: 'Integration connected, no teams found.',
            });
        }

        // 4. Create webhooks for each team concurrently
        const webhookUrl = 'https://weekfuse.com/webhooks/clickup';
        const webhookPromises = teams.map((team) =>
            ky
                .post(`https://api.clickup.com/api/v2/team/${team.id}/webhook`, {
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    json: {
                        endpoint: webhookUrl,
                        events: ['taskCreated', 'taskUpdated', 'taskDeleted'],
                    },
                })
                .catch((err) => {
                    console.error(`Error creating webhook for team ${team.id}:`, err);
                }),
        );
        await Promise.allSettled(webhookPromises);
        console.log('Webhook setup process completed.');

        // 5. Process tasks for each team with pagination and batching
        const DB_BATCH_SIZE = 50;

        for (const team of teams) {
            try {
                console.log(`Processing ClickUp team: ${team.name} (${team.id})`);
                let page = 0;
                let isLastPage = false;

                // Loop through all pages of tasks from the ClickUp API
                while (!isLastPage) {
                    const url = `https://api.clickup.com/api/v2/team/${team.id}/task?page=${page}&assignees[]=${clickUpUserId}&include_markdown_description=true`;
                    const pageData = await ky.get(url, { headers }).json();
                    const pageTasks = pageData.tasks || [];

                    // Process the current page of tasks in batches
                    for (let i = 0; i < pageTasks.length; i += DB_BATCH_SIZE) {
                        const batch = pageTasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            const convertedDesc = task?.markdown_description
                                ? markdownToTipTap(task.markdown_description)
                                : null;
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.name,
                                    description: convertedDesc
                                        ? JSON.stringify(convertedDesc)
                                        : null,
                                    workspace_id,
                                    integration_source: 'clickup',
                                    external_id: task.id,
                                    external_data: task,
                                    host: task.url,
                                    assignee: user_id,
                                    creator: user_id,
                                },
                                {
                                    onConflict:
                                        'integration_source, external_id, host, workspace_id',
                                },
                            );
                        });
                        await Promise.all(upsertPromises);
                    }

                    // ClickUp API indicates the last page with `last_page: true`
                    if (pageData.last_page === true) {
                        isLastPage = true;
                    } else {
                        page++;
                    }
                }
            } catch (teamError) {
                console.error(`Failed to process team ${team.id}:`, teamError);
            }
        }

        console.log('ClickUp initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in ClickUp auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// Handle DELETE requests for disconnecting ClickUp integration
export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id } = body;

        if (!id) {
            return Response.json({ success: false, error: 'Missing id' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get user_id before deleting the integration
        const { data, error } = await supabase
            .from('user_integrations')
            .select('user_id, workspace_id')
            .eq('type', 'clickup')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching ClickUp integration from database:', error);
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
            .eq('type', 'clickup')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting ClickUp integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        const { error: deleteTasksError } = await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'clickup')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        if (deleteTasksError) {
            console.error('Error deleting ClickUp tasks:', deleteTasksError);
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting ClickUp integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}
