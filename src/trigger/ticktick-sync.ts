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

export const ticktickSync = task({
    id: 'ticktick-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting TickTick sync for integration ID: ${payload.id}`);
        const { access_token } = payload;

        try {
            // 1. Fetch all user projects from TickTick
            const headers = { Authorization: `Bearer ${access_token}` };
            const projects = await ky
                .get('https://api.ticktick.com/open/v1/project', { headers })
                .json<any[]>();

            // Add the default "Inbox" project which isn't returned by the projects endpoint
            const allProjects = [{ id: 'inbox', name: 'Inbox' }, ...(projects || [])];

            if (allProjects.length === 0) {
                logger.log('No TickTick projects found for this user.');
                return { success: true, message: 'No projects to sync.' };
            }

            // 2. Process tasks for each project with DB batching
            const DB_BATCH_SIZE = 50;

            for (const project of allProjects) {
                try {
                    logger.log(`Processing TickTick project: ${project.name} (${project.id})`);
                    const projectData = await ky
                        .get(`https://api.ticktick.com/open/v1/project/${project.id}/data`, {
                            headers,
                        })
                        .json<any>();
                    const projectTasks = projectData.tasks || [];

                    if (projectTasks.length === 0) {
                        logger.log(`No tasks found in project: ${project.name}`);
                        continue; // Move to the next project
                    }

                    // Process the tasks for this project in batches
                    for (let i = 0; i < projectTasks.length; i += DB_BATCH_SIZE) {
                        const batch = projectTasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            const tiptapDescription = task.content
                                ? markdownToTipTap(task.content)
                                : null;
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.title,
                                    description: tiptapDescription
                                        ? JSON.stringify(tiptapDescription)
                                        : null,
                                    workspace_id: payload.workspace_id,
                                    integration_source: 'ticktick',
                                    external_id: task.id,
                                    external_data: task,
                                    host: `https://ticktick.com/webapp/#p/${task.projectId}/tasks/${task.id}`,
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
                    logger.log(
                        `Successfully processed ${projectTasks.length} tasks from project: ${project.name}.`,
                    );
                } catch (projectError) {
                    logger.error(
                        `Failed to process project ${project.name} (${project.id}):`,
                        projectError,
                    );
                }
            }

            // 3. Update final sync status
            await supabase
                .from('user_integrations')
                .update({ last_sync: toUTC() })
                .eq('id', payload.id);
            logger.log(`Successfully synced TickTick integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing TickTick integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
