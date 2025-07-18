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

export const clickupSync = task({
    id: 'clickup-sync',
    maxDuration: 3000, // 50 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting ClickUp sync for integration ID: ${payload.id}`);
        const { access_token } = payload;

        try {
            // 1. Fetch user and team data from ClickUp
            const headers = { Authorization: `Bearer ${access_token}` };
            const userData = await ky
                .get('https://api.clickup.com/api/v2/user', { headers })
                .json<any>();
            const teamsData = await ky
                .get('https://api.clickup.com/api/v2/team', { headers })
                .json<any>();

            const clickUpUserId = userData.user.id;
            const teams = teamsData.teams || [];

            if (teams.length === 0) {
                logger.log('No ClickUp teams found for this user.');
                return { success: true, message: 'No teams to sync.' };
            }

            // 2. Process tasks for each team with pagination and batching
            const DB_BATCH_SIZE = 50;

            for (const team of teams) {
                try {
                    logger.log(`Processing ClickUp team: ${team.name} (${team.id})`);
                    let page = 0;
                    let isLastPage = false;
                    let totalTasksProcessed = 0;

                    // Loop through all pages of tasks from the ClickUp API
                    while (!isLastPage) {
                        const url = `https://api.clickup.com/api/v2/team/${team.id}/task?page=${page}&assignees[]=${clickUpUserId}&include_markdown_description=true`;
                        const pageData = await ky.get(url, { headers }).json<any>();
                        const pageTasks = pageData.tasks || [];

                        if (pageTasks.length > 0) {
                            // Process the current page of tasks in batches
                            for (let i = 0; i < pageTasks.length; i += DB_BATCH_SIZE) {
                                const batch = pageTasks.slice(i, i + DB_BATCH_SIZE);
                                const upsertPromises = batch.map((task) => {
                                    // Use markdown_description for conversion, not description
                                    const convertedDesc = task.markdown_description
                                        ? markdownToTipTap(task.markdown_description)
                                        : null;

                                    return supabase.from('tasks').upsert(
                                        {
                                            name: task.name,
                                            description: convertedDesc
                                                ? JSON.stringify(convertedDesc)
                                                : null,
                                            workspace_id: payload.workspace_id,
                                            integration_source: 'clickup',
                                            external_id: task.id,
                                            external_data: task,
                                            host: task.url,
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

                        // ClickUp API indicates the last page with `last_page: true`
                        if (pageData.last_page === true || pageTasks.length === 0) {
                            isLastPage = true;
                        } else {
                            page++;
                        }
                    }
                    logger.log(`Processed ${totalTasksProcessed} tasks from team ${team.name}.`);
                } catch (teamError) {
                    logger.error(`Failed to process team ${team.id}:`, teamError);
                }
            }

            // 3. Update final sync status
            await supabase
                .from('user_integrations')
                .update({ last_sync: toUTC() })
                .eq('id', payload.id);
            logger.log(`Successfully synced ClickUp integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing ClickUp integration ID ${payload.id}:`, error);
            // Optionally update status to 'error' in your DB here
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
