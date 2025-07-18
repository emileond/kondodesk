import { logger, task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../utils/dateUtils';
import ky from 'ky';
import { markdownToTipTap } from '../utils/editorUtils';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

export const todoistSync = task({
    id: 'todoist-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Todoist sync for integration ID: ${payload.id}`);
        const { access_token } = payload;

        try {
            // 1. Fetch and process all tasks with pagination and DB batching
            const headers = { Authorization: `Bearer ${access_token}` };
            const DB_BATCH_SIZE = 50;
            let nextCursor: string | null = null;
            let totalTasksProcessed = 0;

            do {
                const queryParams = nextCursor ? `?cursor=${nextCursor}` : '';
                const response = await ky
                    .get(`https://api.todoist.com/api/v1/tasks${queryParams}`, { headers })
                    .json<any>();
                const pageTasks = response.results || [];

                if (pageTasks.length > 0) {
                    // Process the current page of tasks in batches
                    for (let i = 0; i < pageTasks.length; i += DB_BATCH_SIZE) {
                        const batch = pageTasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            const tiptapDescription = task.description
                                ? markdownToTipTap(task.description)
                                : null;
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.content,
                                    description: tiptapDescription
                                        ? JSON.stringify(tiptapDescription)
                                        : null,
                                    workspace_id: payload.workspace_id,
                                    integration_source: 'todoist',
                                    external_id: task.id.toString(),
                                    external_data: task,
                                    host: `https://todoist.com/app/task/${task.id}`,
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
                    totalTasksProcessed += pageTasks.length;
                }

                nextCursor = response.next_cursor;
            } while (nextCursor);

            logger.log(`Processed a total of ${totalTasksProcessed} tasks from Todoist.`);

            // 2. Update final sync status
            await supabase
                .from('user_integrations')
                .update({ last_sync: toUTC() })
                .eq('id', payload.id);
            logger.log(`Successfully synced Todoist integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Todoist integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
