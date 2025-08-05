import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky, { HTTPError } from 'ky';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

const refreshToken = async ({ integration_id, refresh_token }) => {
    try {
        const res = await ky
            .post('https://api.awork.com/oauth2/token', {
                json: {
                    client_id: process.env.AWORK_CLIENT_ID,
                    client_secret: process.env.AWORK_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: refresh_token,
                },
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
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

export const aworkSync = task({
    id: 'awork-sync',
    maxDuration: 3000,
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({
                last_sync: toUTC(),
                status: 'active',
            })
            .eq('id', payload.id);

        logger.log(`Successfully synced Awork integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.log(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting Awork sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token } = payload;

        const tokenExpired =
            !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
        if (tokenExpired && refresh_token) {
            const res = await refreshToken({
                integration_id: payload.id,
                refresh_token: refresh_token,
            });
            access_token = res.access_token;
        }

        const syncTasks = async (accessToken: string) => {
            const DB_BATCH_SIZE = 50;
            let totalTasksProcessed = 0;
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                try {
                    const tasksResponse = await ky
                        .get(`https://api.awork.com/api/v1/tasks`, {
                            searchParams: {
                                page: page,
                                pageSize: 100,
                                filterBy: 'assignedToMe',
                                orderBy: 'createdOn desc'
                            },
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Accept': 'application/json'
                            },
                        })
                        .json<any>();

                    const tasks = tasksResponse.data || [];
                    totalTasksProcessed += tasks.length;

                    if (tasks.length === 0) {
                        hasMore = false;
                        break;
                    }

                    // Process tasks in batches
                    for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                        const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((aworkTask) => {
                            // Only import incomplete tasks
                            if (aworkTask.taskStatusType === 'done') {
                                return Promise.resolve();
                            }

                            const tiptapDescription = aworkTask.description ? JSON.stringify({
                                type: 'doc',
                                content: [{
                                    type: 'paragraph',
                                    content: [{
                                        type: 'text',
                                        text: aworkTask.description
                                    }]
                                }]
                            }) : null;

                            return supabase.from('tasks').upsert(
                                {
                                    name: aworkTask.name,
                                    description: tiptapDescription,
                                    workspace_id: payload.workspace_id,
                                    integration_source: 'awork',
                                    external_id: aworkTask.id.toString(),
                                    external_data: aworkTask,
                                    host: 'https://app.awork.com',
                                    assignee: payload.user_id,
                                    creator: payload.user_id,
                                    project_id: payload.config?.project_id || null,
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
                    logger.error('Error fetching tasks from Awork:', apiError);
                    hasMore = false;
                }
            }
            logger.log(`Processed ${totalTasksProcessed} total tasks.`);
        };

        try {
            try {
                // First attempt to sync tasks
                await syncTasks(access_token);
            } catch (error) {
                // If it's a 401, refresh the token and retry
                if (error.status === 401) {
                    logger.log('Awork API returned 401. Forcing token refresh and retrying.', {
                        error,
                    });

                    if (!refresh_token) {
                        throw new AbortTaskRunError(
                            'Cannot refresh token: no refresh_token available.',
                        );
                    }

                    const res = await refreshToken({
                        integration_id: payload.id,
                        refresh_token: refresh_token,
                    });
                    access_token = res.access_token;

                    // Retry with the new access token
                    await syncTasks(access_token);
                } else {
                    // It's not a 401, so throw to the outer catch block
                    throw error;
                }
            }

            return { success: true };
        } catch (error) {
            if (error instanceof AbortTaskRunError) {
                throw error;
            }

            logger.error(`Error syncing Awork integration ID ${payload.id}:`, error);
            return { success: false, error: error.message };
        }
    },
});