import { logger, task } from '@trigger.dev/sdk/v3';
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
    maxDuration: 3000, // 50 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Nifty sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token } = payload;

        try {
            // 1. Refresh token if it's expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                logger.log('Nifty token expired, refreshing...');
                const res = await ky
                    .post('https://nifty.pm/oauth/token', {
                        json: {
                            grant_type: 'refresh_token',
                            client_id: process.env.NIFTY_CLIENT_ID,
                            client_secret: process.env.NIFTY_CLIENT_SECRET,
                            refresh_token: refresh_token,
                        },
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json' 
                        },
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

            // 2. Process all assigned tasks using Nifty API
            const DB_BATCH_SIZE = 50;
            let totalTasksProcessed = 0;
            let page = 1;
            let hasMoreTasks = true;

            while (hasMoreTasks) {
                // Get user's assigned tasks from Nifty
                const tasksResponse = await ky
                    .get('https://api.niftypm.com/api/v1.0/tasks', {
                        headers: {
                            'Authorization': `Bearer ${access_token}`,
                            'Accept': 'application/json',
                        },
                        searchParams: {
                            assignee: 'me',
                            status: 'open',
                            limit: 100,
                            page: page,
                        },
                    })
                    .json<any>();

                const tasks = tasksResponse.data || [];
                totalTasksProcessed += tasks.length;

                if (tasks.length === 0) {
                    hasMoreTasks = false;
                    break;
                }

                // Process tasks in batches
                for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                    const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                    const upsertPromises = batch.map((task) => {
                        const tiptapDescription = task.description ? {
                            type: 'doc',
                            content: [{
                                type: 'paragraph',
                                content: [{
                                    type: 'text',
                                    text: task.description
                                }]
                            }]
                        } : null;

                        return supabase.from('tasks').upsert(
                            {
                                name: task.title,
                                description: tiptapDescription
                                    ? JSON.stringify(tiptapDescription)
                                    : null,
                                workspace_id: payload.workspace_id,
                                integration_source: 'nifty',
                                external_id: task.id.toString(),
                                external_data: task,
                                host: 'https://nifty.pm',
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
                // If we got less than 100 tasks, we've reached the end
                if (tasks.length < 100) {
                    hasMoreTasks = false;
                }
            }

            logger.log(`Processed ${totalTasksProcessed} total tasks.`);

            // 3. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced Nifty integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Nifty integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});