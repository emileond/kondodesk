import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky from 'ky';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

export const niftySync = task({
    id: 'nifty-sync',
    maxDuration: 3000,
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

        try {
            // Token refresh logic (unchanged)
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                // ... your token refresh code remains here ...
                logger.log('Nifty token expired, refreshing...');
                const res = await ky
                    .post('https://openapi.niftypm.com/oauth/token', {
                        json: {
                            grant_type: 'refresh_token',
                            client_id: process.env.NIFTY_CLIENT_ID,
                            client_secret: process.env.NIFTY_CLIENT_SECRET,
                            refresh_token: refresh_token,
                        },
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    })
                    .json<any>();

                if (res.error) {
                    throw new AbortTaskRunError(`Token refresh failed: ${res.error_description}`);
                }

                access_token = res.access_token;

                await supabase
                    .from('user_integrations')
                    .update({
                        access_token,
                        refresh_token: res.refresh_token || refresh_token,
                        expires_at: calculateExpiresAt(res.expires_in),
                    })
                    .eq('id', integration_id);
                logger.log('Token refreshed successfully.');
            }

            const niftyUserId = external_data?.id;
            if (!niftyUserId) {
                throw new AbortTaskRunError('Nifty user ID not found in external_data.');
            }

            // NEW: Keep track of all active task IDs from the API
            const activeApiTaskIds: string[] = [];
            const DB_BATCH_SIZE = 50;
            let hasMore = true;
            let offset = 0;

            // Get user's assigned tasks from Nifty
            while (hasMore) {
                logger.log(`Fetching tasks from offset: ${offset}`);
                const tasksResponse = await ky
                    .get('https://openapi.niftypm.com/api/v1.0/tasks', {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                            Accept: 'application/json',
                        },
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
                    // NEW: Add all task IDs from this page to our master list
                    tasks.forEach((task) => activeApiTaskIds.push(task.id));

                    const upsertPromises = tasks.map((task) => {
                        return supabase.from('tasks').upsert(
                            {
                                name: task.name,
                                description: task.description
                                    ? JSON.stringify(task.description)
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
                        );
                    });
                    await Promise.all(upsertPromises);
                }

                hasMore = tasksResponse.hasMore;
                offset += DB_BATCH_SIZE;
            }

            // NEW: Reconcile completed tasks after fetching all active ones
            logger.log(`Found ${activeApiTaskIds.length} active tasks in Nifty. Reconciling...`);
            const query = supabase
                .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: toUTC(),
                })
                .eq('workspace_id', workspace_id)
                .eq('integration_source', 'nifty')
                .eq('status', 'pending');

            if (activeApiTaskIds.length > 0) {
                query.not('external_id', 'in', `(${activeApiTaskIds.join(',')})`);
            }
            const { error: updateError } = await query;
            if (updateError) {
                logger.error('Error during task reconciliation:', updateError);
            } else {
                logger.log('Successfully reconciled completed tasks.');
            }

            // Update final sync status
            await supabase
                .from('user_integrations')
                .update({ last_sync: toUTC(), status: 'active' })
                .eq('id', payload.id);

            logger.log(`Successfully synced Nifty integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Nifty integration ID ${payload.id}:`, error);
            if (error instanceof AbortTaskRunError) {
                await supabase
                    .from('user_integrations')
                    .update({ status: 'error' })
                    .eq('id', payload.id);
            }
            return { success: false, error: error.message };
        }
    },
});
