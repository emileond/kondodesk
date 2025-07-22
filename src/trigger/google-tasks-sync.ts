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

export const googleTasksSync = task({
    id: 'google_tasks-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Google Tasks sync for integration ID: ${payload.id}`);
        let { access_token } = payload;

        try {
            // 1. Refresh token if it has expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && payload.refresh_token) {
                logger.log('Google Tasks token expired, refreshing...');
                const res = await ky
                    .post('https://oauth2.googleapis.com/token', {
                        json: {
                            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
                            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
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

            // 2. Fetch all task lists
            const headers = { Authorization: `Bearer ${access_token}` };
            const taskListsResponse = await ky
                .get('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers })
                .json<any>();

            const taskLists = taskListsResponse.items || [];
            if (taskLists.length === 0) {
                logger.log('No Google Tasks lists found.');
                return { success: true, message: 'No task lists found.' };
            }

            // 3. Process each task list individually
            const DB_BATCH_SIZE = 50;
            let totalTasksProcessed = 0;

            for (const taskList of taskLists) {
                try {
                    logger.log(`Processing Google Tasks list: ${taskList.title} (${taskList.id})`);

                    // Get tasks from this list (only incomplete tasks)
                    const tasksResponse = await ky
                        .get(`https://tasks.googleapis.com/tasks/v1/lists/${taskList.id}/tasks`, {
                            headers,
                            searchParams: {
                                showCompleted: false,
                                showDeleted: false,
                                maxResults: 100,
                            },
                        })
                        .json<any>();

                    const tasks = tasksResponse.items || [];

                    // Process tasks in batches
                    for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                        const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.title || 'Untitled Task',
                                    description: task.notes || null,
                                    workspace_id: payload.workspace_id,
                                    integration_source: 'google_tasks',
                                    external_id: task.id,
                                    external_data: {
                                        ...task,
                                        taskListId: taskList.id,
                                        taskListTitle: taskList.title,
                                    },
                                    host: 'tasks.google.com',
                                    assignee: payload.user_id,
                                    creator: payload.user_id,
                                    due_date: task.due ? new Date(task.due).toISOString() : null,
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

                    totalTasksProcessed += tasks.length;
                    logger.log(`Processed ${tasks.length} tasks from list ${taskList.title}`);
                } catch (listError) {
                    logger.error(`Failed to process task list ${taskList.id}:`, listError);
                }
            }

            logger.log(`Total tasks processed: ${totalTasksProcessed}`);

            // 4. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced Google Tasks integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Google Tasks integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
