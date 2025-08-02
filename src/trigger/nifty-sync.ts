import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { markdownToTipTap } from '../utils/editorUtils';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky, { HTTPError } from 'ky';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

/**
 * Reusable helper to refresh the Nifty OAuth token.
 */
const refreshTokenForNifty = async ({ integration_id, refresh_token }) => {
    logger.log('Refreshing Nifty token...', { integration_id });
    try {
        const credentials = `${process.env.NIFTY_CLIENT_ID}:${process.env.NIFTY_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        const res = await ky
            .post('https://openapi.niftypm.com/oauth/token', {
                json: {
                    grant_type: 'refresh_token',
                    refresh_token: refresh_token,
                },
                headers: {
                    authorization: `Basic ${encodedCredentials}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
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

export const niftySync = task({
    id: 'nifty-sync',
    maxDuration: 3000,
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({ last_sync: toUTC(), status: 'active' })
            .eq('id', payload.id);
        logger.log(`Successfully synced Nifty integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.log(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting Nifty sync for integration ID: ${payload.id}`);
        let {
            access_token,
            refresh_token,
            id: integration_id,
            external_data,
            user_id,
            workspace_id,
        } = payload;

        /**
         * The core sync logic, extracted into a function.
         */
        const performNiftySync = async (currentToken: string) => {
            const niftyUserId = external_data?.id;
            if (!niftyUserId) {
                throw new AbortTaskRunError('Nifty user ID not found in external_data.');
            }

            const activeApiTaskIds: string[] = [];
            const DB_BATCH_SIZE = 50;
            let hasMore = true;
            let offset = 0;

            while (hasMore) {
                const tasksResponse = await ky
                    .get('https://openapi.niftypm.com/api/v1.0/tasks', {
                        headers: { Authorization: `Bearer ${currentToken}` },
                        searchParams: {
                            member_id: niftyUserId,
                            completed: false,
                            limit: DB_BATCH_SIZE,
                            offset,
                        },
                    })
                    .json<any>();

                const tasks = tasksResponse.tasks || [];

                if (tasks.length > 0) {
                    tasks.forEach((task) => activeApiTaskIds.push(task.id));
                    const upsertPromises = tasks.map((task) =>
                        supabase.from('tasks').upsert(
                            {
                                name: task.name,
                                description: task.description
                                    ? markdownToTipTap(task.description)
                                    : null,
                                workspace_id,
                                integration_source: 'nifty',
                                external_id: task.id,
                                external_data: task,
                                host: 'https://nifty.pm',
                                assignee: user_id,
                                creator: user_id,
                                status: 'pending',
                                completed_at: null,
                            },
                            { onConflict: 'integration_source, external_id, host, workspace_id' },
                        ),
                    );
                    await Promise.all(upsertPromises);
                }
                hasMore = tasksResponse.hasMore;
                offset += DB_BATCH_SIZE;
            }

            // Reconcile completed tasks
            const query = supabase
                .from('tasks')
                .update({ status: 'completed', completed_at: toUTC() })
                .eq('workspace_id', workspace_id)
                .eq('integration_source', 'nifty')
                .eq('status', 'pending');

            if (activeApiTaskIds.length > 0) {
                query.not('external_id', 'in', `(${activeApiTaskIds.join(',')})`);
            }
            await query;
        };

        try {
            // 1. Proactive Check (Optimization)
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                const newTokens = await refreshTokenForNifty({ integration_id, refresh_token });
                access_token = newTokens.access_token;
            }

            try {
                // First attempt to sync tasks
                await performNiftySync(access_token);
            } catch (error) {
                // 2. Reactive Handler (Reliability Fallback)
                if (error instanceof ky.HTTPError && error.response.status === 401) {
                    logger.log('Nifty API returned 401. Forcing token refresh and retrying.', {
                        error,
                    });

                    if (!refresh_token) {
                        throw new AbortTaskRunError(
                            'Cannot refresh token: no refresh_token available.',
                        );
                    }

                    const newTokens = await refreshTokenForNifty({ integration_id, refresh_token });
                    access_token = newTokens.access_token;

                    // Retry with the new token
                    await performNiftySync(access_token);
                } else {
                    throw error;
                }
            }

            // If we reach here, the sync was successful
            return { success: true };
        } catch (error) {
            if (error instanceof AbortTaskRunError) {
                throw error;
            }

            logger.error(`Error syncing Nifty integration ID ${payload.id}:`, error);
            return { success: false, error: error.message };
        }
    },
});
