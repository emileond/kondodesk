import { logger, task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import { Octokit } from 'octokit';
import { markdownToTipTap } from '../utils/editorUtils';
import ky from 'ky';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

export const githubSync = task({
    id: 'github-sync',
    maxDuration: 3000, // 50 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting GitHub sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token } = payload;

        try {
            // 1. Refresh token if it's expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                logger.log('GitHub token expired, refreshing...');
                const res = await ky
                    .post('https://github.com/login/oauth/access_token', {
                        json: {
                            client_id: process.env.GITHUB_CLIENT_ID,
                            client_secret: process.env.GITHUB_CLIENT_SECRET,
                            grant_type: 'refresh_token',
                            refresh_token: refresh_token,
                        },
                        headers: { Accept: 'application/json' },
                    })
                    .json<any>();

                if (res.error) throw new Error(`Token refresh failed: ${res.error_description}`);

                access_token = res.access_token;
                await supabase
                    .from('user_integrations')
                    .update({
                        access_token,
                        refresh_token: res.refresh_token || refresh_token,
                        expires_at: calculateExpiresAt(res.expires_in),
                    })
                    .eq('id', payload.id);
                logger.log('Token refreshed successfully.');
            }

            // 2. Process all assigned issues using pagination and batching
            const octokit = new Octokit({ auth: access_token });
            const DB_BATCH_SIZE = 50;
            let totalTasksProcessed = 0;

            await octokit.paginate(
                'GET /issues',
                { filter: 'assigned', state: 'open', per_page: 100 },
                (response, done) => {
                    const pageIssues = response.data;
                    totalTasksProcessed += pageIssues.length;

                    // This async function processes batches within the synchronous callback
                    const processBatches = async () => {
                        for (let i = 0; i < pageIssues.length; i += DB_BATCH_SIZE) {
                            const batch = pageIssues.slice(i, i + DB_BATCH_SIZE);
                            const upsertPromises = batch.map((issue) => {
                                // Skip pull requests, which are also returned by the issues endpoint
                                if (issue.pull_request) return Promise.resolve();

                                const convertedDesc = issue.body
                                    ? markdownToTipTap(issue.body)
                                    : null;
                                return supabase.from('tasks').upsert(
                                    {
                                        name: issue.title,
                                        description: convertedDesc
                                            ? JSON.stringify(convertedDesc)
                                            : null,
                                        workspace_id: payload.workspace_id,
                                        integration_source: 'github',
                                        external_id: issue.id.toString(),
                                        external_data: issue,
                                        host: 'https://github.com',
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
                    };

                    return processBatches();
                },
            );

            logger.log(`Processed ${totalTasksProcessed} total issues.`);

            // 3. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced GitHub integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing GitHub integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
