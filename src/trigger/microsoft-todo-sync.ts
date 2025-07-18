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

export const microsoftToDoSync = task({
    id: 'microsoft_todo-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Microsoft To Do sync for integration ID: ${payload.id}`);
        let { access_token } = payload;

        try {
            // 1. Refresh token if it's expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && payload.refresh_token) {
                logger.log('Microsoft token expired, refreshing...');
                const res = await ky
                    .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                        body: new URLSearchParams({
                            client_id: process.env.MICROSOFT_TODO_CLIENT_ID as string,
                            client_secret: process.env.MICROSOFT_TODO_CLIENT_SECRET as string,
                            refresh_token: payload.refresh_token,
                            grant_type: 'refresh_token',
                        }),
                    })
                    .json<any>();

                if (res.error) throw new Error(`Token refresh failed: ${res.error_description}`);

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
            const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };
            const taskListsResponse = await ky
                .get('https://graph.microsoft.com/v1.0/me/todo/lists', { headers })
                .json<any>();
            const taskLists = taskListsResponse.value || [];

            if (taskLists.length === 0) {
                logger.log('No Microsoft To Do task lists found.');
                return { success: true, message: 'No lists to sync.' };
            }

            // 3. Process each task list with pagination and DB batching
            const DB_BATCH_SIZE = 50;

            for (const list of taskLists) {
                try {
                    logger.log(`Processing list: ${list.displayName} (${list.id})`);
                    let nextLink: string | null =
                        `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks`;
                    let totalTasksProcessed = 0;

                    while (nextLink) {
                        const pageResponse = await ky.get(nextLink, { headers }).json<any>();
                        const pageTasks = pageResponse.value || [];
                        const incompleteTasks = pageTasks.filter(
                            (task: any) => task.status !== 'completed',
                        );

                        if (incompleteTasks.length > 0) {
                            for (let i = 0; i < incompleteTasks.length; i += DB_BATCH_SIZE) {
                                const batch = incompleteTasks.slice(i, i + DB_BATCH_SIZE);
                                const upsertPromises = batch.map((task: any) =>
                                    supabase.from('tasks').upsert(
                                        {
                                            name: task.title,
                                            description: task.body?.content || null,
                                            workspace_id: payload.workspace_id,
                                            integration_source: 'microsoft_todo',
                                            external_id: task.id,
                                            external_data: {
                                                ...task,
                                                listId: list.id,
                                                listName: list.displayName,
                                            },
                                            host: 'https://to-do.office.com',
                                            assignee: payload.user_id,
                                            creator: payload.user_id,
                                            project_id: payload.config?.project_id || null,
                                        },
                                        {
                                            onConflict:
                                                'integration_source, external_id, host, workspace_id',
                                        },
                                    ),
                                );
                                await Promise.all(upsertPromises);
                            }
                            totalTasksProcessed += incompleteTasks.length;
                        }
                        nextLink = pageResponse['@odata.nextLink'] || null;
                    }
                    logger.log(
                        `Processed ${totalTasksProcessed} tasks from list: ${list.displayName}`,
                    );
                } catch (listError) {
                    logger.error(`Failed to process list ${list.id}:`, listError);
                }
            }

            // 4. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced Microsoft To Do integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Microsoft To Do integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
