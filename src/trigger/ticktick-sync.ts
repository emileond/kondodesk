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
        const { access_token, workspace_id, user_id, config } = payload;

        try {
            // 1. Fetch all user projects from TickTick
            const headers = { Authorization: `Bearer ${access_token}` };
            const projects = await ky
                .get('https://api.ticktick.com/open/v1/project', { headers })
                .json<any[]>();

            const allProjects = [{ id: 'inbox', name: 'Inbox' }, ...(projects || [])];

            if (allProjects.length === 0) {
                logger.log('No TickTick projects found for this user.');
                return { success: true, message: 'No projects to sync.' };
            }

            // NEW: Keep track of all active task IDs from the API
            const activeApiTaskIds: string[] = [];

            // 2. Process tasks for each project
            const DB_BATCH_SIZE = 50;
            for (const project of allProjects) {
                try {
                    const projectData = await ky
                        .get(`https://api.ticktick.com/open/v1/project/${project.id}/data`, {
                            headers,
                        })
                        .json<any>();
                    const projectTasks = projectData.tasks || [];

                    if (projectTasks.length === 0) {
                        continue;
                    }

                    // Add all task IDs from this project to our primary list
                    projectTasks.forEach((task) => activeApiTaskIds.push(task.id));

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
                                    workspace_id,
                                    integration_source: 'ticktick',
                                    external_id: task.id,
                                    external_data: task,
                                    host: `https://ticktick.com/webapp/#p/${task.projectId}/tasks/${task.id}`,
                                    assignee: user_id,
                                    creator: user_id,
                                    project_id: config?.project_id || null,
                                    status: 'pending',
                                    completed_at: null,
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

            // 3. NEW: Reconcile completed tasks
            // Find tasks in our DB that are pending or in progress but were NOT in the active list from the API.
            // These are the tasks that were completed in TickTick since the last sync.
            logger.log(
                `Found ${activeApiTaskIds.length} active tasks in TickTick. Reconciling completed tasks...`,
            );

            const query = supabase
                .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: toUTC(),
                })
                .eq('workspace_id', workspace_id)
                .eq('integration_source', 'ticktick')
                .in('status', ['pending', 'in progress']);

            // If we found active tasks, exclude them from the update.
            // If the list is empty, all of the user's tasks are now complete.
            if (activeApiTaskIds.length > 0) {
                query.not('external_id', 'in', `(${activeApiTaskIds.join(',')})`);
            }

            const { error: updateError } = await query;

            if (updateError) {
                // Log the error but don't fail the entire job, as the main sync part succeeded.
                logger.error('Error updating completed tasks status:');
                console.error(updateError);
            } else {
                logger.log('Successfully reconciled completed tasks.');
            }

            // 4. Update final sync status
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
