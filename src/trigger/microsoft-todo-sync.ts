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
        logger.log('Starting Microsoft To Do sync task');

        try {
            // Get project_id from integration config if available
            const project_id = payload.config?.project_id || null;

            // Check if token has expired
            const currentTime = dayjs().utc();
            const tokenExpired =
                !payload.expires_at || currentTime.isAfter(dayjs(payload.expires_at));

            let access_token = payload.access_token;
            let refresh_token = payload.refresh_token;
            let expires_at = payload.expires_at;

            // Only refresh token if it has expired
            if (tokenExpired) {
                logger.log(`Access token expired, refreshing`);

                try {
                    const res = await ky
                        .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                            body: new URLSearchParams({
                                client_id: process.env.MICROSOFT_TODO_CLIENT_ID as string,
                                client_secret: process.env.MICROSOFT_TODO_CLIENT_SECRET as string,
                                refresh_token: payload.refresh_token,
                                grant_type: 'refresh_token',
                                scope: 'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read offline_access',
                            }),
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                        })
                        .json();

                    if (res.error) {
                        logger.error('Failed to refresh access token', res.error);
                        await supabase
                            .from('user_integrations')
                            .update({
                                status: 'error',
                            })
                            .eq('id', payload.id);
                        return;
                    } else {
                        // Update token information
                        access_token = res.access_token;
                        refresh_token = res.refresh_token;
                        expires_at = calculateExpiresAt(res.expires_in);

                        // Update the database with new token information
                        await supabase
                            .from('user_integrations')
                            .update({
                                access_token,
                                refresh_token,
                                expires_at,
                                last_sync: toUTC(),
                            })
                            .eq('id', payload.id);
                    }
                } catch (tokenError) {
                    logger.error('Error refreshing token:', tokenError);
                    await supabase
                        .from('user_integrations')
                        .update({
                            status: 'error',
                        })
                        .eq('id', payload.id);
                    return;
                }
            } else {
                // Token is still valid, just update the last_sync timestamp
                await supabase
                    .from('user_integrations')
                    .update({
                        last_sync: toUTC(),
                    })
                    .eq('id', payload.id);
            }

            // Fetch task lists from Microsoft Graph API
            const taskListsResponse = await ky
                .get('https://graph.microsoft.com/v1.0/me/todo/lists', {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Accept: 'application/json',
                    },
                })
                .json();

            const taskLists = taskListsResponse.value || [];

            if (taskLists.length === 0) {
                logger.log('No task lists found');
                return;
            }

            let allUpsertPromises = [];
            let allTasksData = [];

            // Process each task list
            for (const list of taskLists) {
                try {
                    logger.log(`Processing list: ${list.displayName} (${list.id})`);

                    // Fetch tasks from the current list
                    const tasksResponse = await ky
                        .get(`https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks`, {
                            headers: {
                                Authorization: `Bearer ${access_token}`,
                                Accept: 'application/json',
                            },
                        })
                        .json();

                    const tasks = tasksResponse.value || [];

                    // Filter for incomplete tasks only
                    const incompleteTasks = tasks.filter((task) => task.status !== 'completed');

                    logger.log(
                        `Found ${incompleteTasks.length} incomplete tasks in list ${list.displayName}`,
                    );

                    if (incompleteTasks.length > 0) {
                        const upsertPromises = incompleteTasks.map((task) => {
                            return supabase.from('tasks').upsert(
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
                                    project_id: project_id,
                                },
                                {
                                    onConflict:
                                        'integration_source, external_id, host, workspace_id',
                                },
                            );
                        });

                        // Add the promises and tasks to our arrays for later processing
                        allUpsertPromises = [...allUpsertPromises, ...upsertPromises];
                        allTasksData = [...allTasksData, ...incompleteTasks];
                    }
                } catch (listError) {
                    logger.error(`Error processing list ${list.id}: ${listError.message}`);
                    // Continue with other lists even if one fails
                }
            }

            // Wait for all upsert operations to complete
            if (allUpsertPromises.length > 0) {
                const results = await Promise.all(allUpsertPromises);

                let taskSuccessCount = 0;
                let taskFailCount = 0;

                results.forEach((result, index) => {
                    if (result.error) {
                        logger.error(
                            `Upsert error for task ${allTasksData[index].id}: ${result.error.message}`,
                        );
                        taskFailCount++;
                    } else {
                        taskSuccessCount++;
                    }
                });

                logger.log(
                    `Processed ${allTasksData.length} tasks for workspace ${payload.workspace_id}: ${taskSuccessCount} succeeded, ${taskFailCount} failed`,
                );
            } else {
                logger.log('No tasks to process');
            }

            logger.log('Microsoft To Do sync completed successfully');
        } catch (error) {
            logger.error('Error in Microsoft To Do sync:', error);

            // Update integration status to error
            await supabase
                .from('user_integrations')
                .update({
                    status: 'error',
                })
                .eq('id', payload.id);

            throw error;
        }
    },
});
