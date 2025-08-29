import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import { Octokit } from 'octokit';
import { markdownToTipTap } from '../utils/editorUtils';
import ky, { HTTPError } from 'ky';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

const refreshToken = async ({ integration_id, refresh_token }) => {
    try {
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

        if (res.error) {
            throw new AbortTaskRunError(`Token refresh failed: ${res.error_description}`);
        }

        await supabase
            .from('user_integrations')
            .update({
                access_token: res.access_token,
                refresh_token: res.refresh_token,
                expires_at: calculateExpiresAt(res.expires_in),
                status: 'active',
            })
            .eq('id', integration_id);

        logger.log('Token refreshed successfully.');
        return res;
    } catch (error) {
        if (error instanceof HTTPError) {
            throw new AbortTaskRunError(
                `Token refresh failed with status ${error.response.status}`,
            );
        }
        throw error;
    }
};

export const githubSync = task({
    id: 'github-sync',
    maxDuration: 3000,
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({
                last_sync: toUTC(),
                status: 'active',
            })
            .eq('id', payload.id);

        logger.log(`Successfully synced GitHub integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.log(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting GitHub sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token } = payload;

        const tokenExpired =
            !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));

        if (tokenExpired && refresh_token) {
            logger.log('Token expired, attempting to refresh.');
            const res = await refreshToken({
                integration_id: payload.id,
                refresh_token: refresh_token,
            });
            access_token = res.access_token;
        }

        const syncIssues = async (apiClient: Octokit) => {
            const DB_BATCH_SIZE = 50;
            let totalTasksProcessed = 0;
            await apiClient.paginate(
                'GET /issues',
                { filter: 'assigned', state: 'open', per_page: 100 },
                (response) => {
                    const pageIssues = response.data;
                    totalTasksProcessed += pageIssues.length;
                    const processBatches = async () => {
                        for (let i = 0; i < pageIssues.length; i += DB_BATCH_SIZE) {
                            const batch = pageIssues.slice(i, i + DB_BATCH_SIZE);
                            const upsertPromises = batch.map((issue) => {
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
        };

        try {
            const octokit = new Octokit({ auth: access_token });

            // First attempt to sync issues
            await syncIssues(octokit);

            return { success: true };
        } catch (error) {
            // If the first attempt fails, check if we have a refresh token
            if (refresh_token) {
                logger.log('API call failed. Attempting token refresh and retry.');
                try {
                    const res = await refreshToken({
                        integration_id: payload.id,
                        refresh_token: refresh_token,
                    });

                    const newOctokit = new Octokit({ auth: res.access_token });
                    await syncIssues(newOctokit);

                    return { success: true };
                } catch (retryError) {
                    // If the retry also fails, throw the error
                    logger.error(
                        `Token refresh and retry failed for ID ${payload.id}:`,
                        retryError,
                    );
                    throw retryError;
                }
            }

            // If there's no refresh token, or the first attempt fails and we've already tried a refresh
            if (error instanceof AbortTaskRunError) {
                throw error;
            }

            logger.error(`Error syncing Github integration ID ${payload.id}:`, error);
            return { success: false, error: error.message };
        }
    },
});
