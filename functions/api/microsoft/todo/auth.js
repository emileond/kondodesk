import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle POST requests for initiating Microsoft To Do OAuth flow
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
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                body: new URLSearchParams({
                    client_id: context.env.MICROSOFT_CLIENT_ID,
                    client_secret: context.env.MICROSOFT_CLIENT_SECRET,
                    code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/microsoft_todo',
                    grant_type: 'authorization_code',
                    scope: 'Tasks.ReadWrite User.Read offline_access',
                }),
            })
            .json();

        const { access_token, refresh_token, expires_in, scope } = await tokenResponse;
        if (!access_token)
            return Response.json(
                { success: false, error: 'Failed to get access token' },
                { status: 500 },
            );

        const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };

        const grantedScopes = scope ? scope.split(' ') : [];

        // 2. Save the initial integration data
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;
        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'microsoft',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                scopes: grantedScopes,
            })
            .select('id')
            .single();

        if (upsertError)
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        const integration_id = upsertData.id;

        // Fetch user data and update record
        try {
            const userData = await ky
                .get('https://graph.microsoft.com/v1.0/me', { headers })
                .json();
            await supabase
                .from('user_integrations')
                .update({ external_data: userData })
                .eq('id', integration_id);
        } catch (userDataError) {
            console.error('Could not fetch Microsoft user data:', userDataError);
        }

        // 3. Fetch task lists
        const taskListsResponse = await ky
            .get('https://graph.microsoft.com/v1.0/me/todo/lists', { headers })
            .json();
        const taskLists = taskListsResponse.value || [];

        // 4. Process tasks for each list with pagination and batching
        const DB_BATCH_SIZE = 50;
        console.log(`Starting initial import for ${taskLists.length} Microsoft To Do lists.`);

        for (const list of taskLists) {
            try {
                console.log(`Fetching tasks for list: ${list.displayName} (${list.id})`);
                let nextLink = `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks`;

                while (nextLink) {
                    const pageResponse = await ky.get(nextLink, { headers }).json();
                    const pageTasks = pageResponse.value || [];
                    const incompleteTasks = pageTasks.filter((task) => task.status !== 'completed');

                    if (incompleteTasks.length > 0) {
                        for (let i = 0; i < incompleteTasks.length; i += DB_BATCH_SIZE) {
                            const batch = incompleteTasks.slice(i, i + DB_BATCH_SIZE);
                            const upsertPromises = batch.map((task) =>
                                supabase.from('tasks').upsert(
                                    {
                                        name: task.title,
                                        description: task.body?.content || null,
                                        workspace_id,
                                        integration_source: 'microsoft',
                                        external_id: task.id,
                                        external_data: {
                                            ...task,
                                            listId: list.id,
                                            listName: list.displayName,
                                        },
                                        host: 'https://to-do.office.com',
                                        assignee: user_id,
                                        creator: user_id,
                                    },
                                    {
                                        onConflict:
                                            'integration_source, external_id, host, workspace_id',
                                    },
                                ),
                            );
                            await Promise.all(upsertPromises);
                        }
                    }
                    // Microsoft Graph API provides the full URL for the next page
                    nextLink = pageResponse['@odata.nextLink'] || null;
                }
            } catch (listError) {
                console.error(`Failed to process list ${list.id}:`, listError);
            }
        }

        console.log('Microsoft To Do initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Microsoft To Do auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
