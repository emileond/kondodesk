import { logger, task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky from 'ky';
import { convertJiraAdfToTiptap } from '../utils/editorUtils';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

export const jiraSync = task({
    id: 'jira-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Jira sync for integration ID: ${payload.id}`);
        let { access_token } = payload;

        try {
            // 1. Refresh token if it has expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && payload.refresh_token) {
                logger.log('Jira token expired, refreshing...');
                const res = await ky
                    .post('https://auth.atlassian.com/oauth/token', {
                        json: {
                            client_id: process.env.JIRA_CLIENT_ID,
                            client_secret: process.env.JIRA_CLIENT_SECRET,
                            refresh_token: payload.refresh_token,
                            grant_type: 'refresh_token',
                        },
                    })
                    .json<any>();

                if (res.error) throw new Error(`Token refresh failed: ${res.error}`);

                access_token = res.access_token;
                await supabase
                    .from('user_integrations')
                    .update({
                        access_token,
                        refresh_token: res.refresh_token || payload.refresh_token,
                        expires_at: calculateExpiresAt(res.expires_in),
                    })
                    .eq('id', payload.id);
                logger.log('Token refreshed successfully.');
            }

            // 2. Fetch accessible resources (Jira sites)
            const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };
            const resources = await ky
                .get('https://api.atlassian.com/oauth/token/accessible-resources', { headers })
                .json<any>();

            if (!resources || resources.length === 0) {
                logger.error('No accessible Jira resources found.');
                return { success: true, message: 'No sites found.' };
            }

            // 3. Process each Jira resource individually
            const DB_BATCH_SIZE = 50;
            const API_MAX_RESULTS = 50;

            for (const resource of resources) {
                try {
                    logger.log(`Processing Jira resource: ${resource.name} (${resource.id})`);
                    let startAt = 0;
                    let isLastPage = false;
                    let totalTasksProcessed = 0;

                    // Loop through all pages of issues from the Jira API
                    while (!isLastPage) {
                        const url = `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/search?jql=assignee=currentUser()%20AND%20statusCategory!=Done&startAt=${startAt}&maxResults=${API_MAX_RESULTS}`;
                        const pageData = await ky.get(url, { headers }).json<any>();
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
                                        workspace_id: payload.workspace_id,
                                        integration_source: 'jira',
                                        external_id: issue.id,
                                        external_data: issue,
                                        host: resource.url,
                                        assignee: payload.user_id,
                                        creator: payload.user_id,
                                        project_id: payload.config?.project_id || null,
                                    },
                                    {
                                        onConflict:
                                            'integration_source, external_id, host, workspace_id',
                                    },
                                );
                            });
                            await Promise.all(upsertPromises);
                        }
                        totalTasksProcessed += pageIssues.length;

                        // Check if we've reached the last page
                        if (pageData.startAt + pageIssues.length >= pageData.total) {
                            isLastPage = true;
                        } else {
                            startAt += API_MAX_RESULTS;
                        }
                    }
                    logger.log(
                        `Processed ${totalTasksProcessed} issues from resource ${resource.name}.`,
                    );
                } catch (resourceError) {
                    logger.error(`Failed to process resource ${resource.id}:`, resourceError);
                }
            }

            // 4. Check and refresh webhooks
            logger.log('Checking and refreshing webhooks...');
            for (const resource of resources) {
                try {
                    const webhooksResponse = await ky
                        .get(
                            `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/webhook/refresh`,
                            { headers },
                        )
                        .json<any>();
                    const expiringWebhookIds = webhooksResponse.values
                        .filter(
                            (hook: any) =>
                                hook.expirationDate &&
                                dayjs(hook.expirationDate).diff(dayjs(), 'day') <= 7,
                        )
                        .map((hook: any) => hook.id);

                    if (expiringWebhookIds.length > 0) {
                        logger.log(
                            `Refreshing ${expiringWebhookIds.length} expiring webhooks for resource ${resource.id}`,
                        );
                        await ky.put(
                            `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/webhook/refresh`,
                            {
                                headers: { ...headers, 'Content-Type': 'application/json' },
                                json: { webhookIds: expiringWebhookIds },
                            },
                        );
                    }
                } catch (webhookError) {
                    logger.error(
                        `Error checking/refreshing webhooks for resource ${resource.id}:`,
                        webhookError,
                    );
                }
            }

            // 5. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced Jira integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Jira integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
