import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';
import { convertJiraAdfToTiptap } from '../../../src/utils/editorUtils.js';

// Handle DELETE requests for disconnecting Jira integration
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
            .eq('type', 'jira')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Jira integration from database:', error);
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
            .eq('type', 'jira')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Jira integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'jira')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Jira integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Webhook events to listen for
// Assuming WEBHOOK_EVENTS is defined elsewhere, e.g.:
const WEBHOOK_EVENTS = ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'];

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
            .post('https://auth.atlassian.com/oauth/token', {
                json: {
                    client_id: context.env.JIRA_CLIENT_ID,
                    client_secret: context.env.JIRA_CLIENT_SECRET,
                    code: code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/jira',
                    grant_type: 'authorization_code',
                },
            })
            .json();

        const { access_token, refresh_token, expires_in } = await tokenResponse;

        if (!access_token) {
            console.error('Jira token exchange error:', tokenResponse);
            throw new Error(tokenResponse.error || 'Failed to get Jira access token');
        }

        // 2. Save the initial integration data
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;
        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'jira',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: { syncStatus: 'prompt' },
            })
            .select('id')
            .single();

        if (upsertError) throw new Error('Failed to save integration data');
        const integration_id = upsertData.id;

        // 3. Fetch accessible resources (Jira sites)
        const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };
        const resources = await ky
            .get('https://api.atlassian.com/oauth/token/accessible-resources', { headers })
            .json();

        if (!resources || resources.length === 0) {
            console.log('No accessible Jira resources found.');
            return Response.json({
                success: true,
                message: 'Integration connected, no sites found.',
            });
        }

        // Fetch user data from the first resource and update the integration record
        try {
            const userData = await ky
                .get(`https://api.atlassian.com/ex/jira/${resources[0].id}/rest/api/3/myself`, {
                    headers,
                })
                .json();
            await supabase
                .from('user_integrations')
                .update({ external_data: userData })
                .eq('id', integration_id);
        } catch (userDataError) {
            console.error('Could not fetch Jira user data:', userDataError);
        }

        // 4. Process issues for each resource with pagination and batching
        const DB_BATCH_SIZE = 50;
        const API_MAX_RESULTS = 50;

        for (const resource of resources) {
            try {
                console.log(`Processing Jira resource: ${resource.name} (${resource.id})`);
                let startAt = 0;
                let isLastPage = false;

                // Loop through all pages of issues from the Jira API
                while (!isLastPage) {
                    const url = `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/search?jql=assignee=currentUser()%20AND%20statusCategory!=Done&startAt=${startAt}&maxResults=${API_MAX_RESULTS}`;
                    const pageData = await ky.get(url, { headers }).json();
                    const pageIssues = pageData.issues || [];

                    // Process the current page of issues in batches
                    for (let i = 0; i < pageIssues.length; i += DB_BATCH_SIZE) {
                        const batch = pageIssues.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((issue) => {
                            const convertedDesc = convertJiraAdfToTiptap(
                                issue?.fields?.description,
                            );
                            return supabase.from('tasks').upsert(
                                {
                                    name: issue.fields.summary,
                                    description: convertedDesc || null,
                                    workspace_id,
                                    integration_source: 'jira',
                                    external_id: issue.id,
                                    external_data: issue,
                                    host: resource.url,
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

                    // Check if we've reached the last page
                    if (pageData.startAt + pageData.issues.length >= pageData.total) {
                        isLastPage = true;
                    } else {
                        startAt += API_MAX_RESULTS;
                    }
                }
            } catch (resourceError) {
                console.error(`Failed to process resource ${resource.id}:`, resourceError);
            }
        }

        // 5. Register webhooks for each resource
        for (const resource of resources) {
            try {
                const webhookUrl = `https://weekfuse.com/webhooks/jira`;
                await ky.post(
                    `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/webhook`,
                    {
                        json: {
                            url: webhookUrl,
                            webhooks: [
                                { events: WEBHOOK_EVENTS, jqlFilter: 'assignee = currentUser()' },
                            ],
                        },
                        headers: { ...headers, 'Content-Type': 'application/json' },
                    },
                );
                console.log(`Webhook registered for resource ${resource.id}`);
            } catch (webhookError) {
                // It's common for this to fail if a webhook already exists.
                // A more robust implementation would fetch existing webhooks first.
                console.warn(
                    `Could not register webhook for resource ${resource.id}:`,
                    webhookError.message,
                );
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Jira auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
