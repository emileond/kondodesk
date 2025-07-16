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

export const asanaSync = task({
    id: 'asana-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log('Starting Asana sync task');

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

            // Only refresh token if it has expired and refresh_token is available
            if (tokenExpired && refresh_token) {
                logger.log(`Access token expired, refreshing`);
                try {
                    const res = await ky
                        .post('https://app.asana.com/-/oauth_token', {
                            body: new URLSearchParams({
                                client_id: process.env.ASANA_CLIENT_ID,
                                client_secret: process.env.ASANA_CLIENT_SECRET,
                                refresh_token: payload.refresh_token,
                                grant_type: 'refresh_token',
                            }),
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
                        return { success: false, error: 'Token refresh failed' };
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
                } catch (refreshError) {
                    logger.error('Error refreshing token:', refreshError);
                    await supabase
                        .from('user_integrations')
                        .update({
                            status: 'error',
                        })
                        .eq('id', payload.id);
                    return { success: false, error: 'Token refresh failed' };
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

            // Fetch workspaces the user has access to
            const workspacesResponse = await ky
                .get('https://app.asana.com/api/1.0/workspaces', {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Accept: 'application/json',
                    },
                })
                .json();

            const workspaces = workspacesResponse.data || [];

            if (!workspaces || workspaces.length === 0) {
                logger.error('No accessible Asana workspaces found');
                return { success: false, error: 'No workspaces found' };
            }

            let allUpsertPromises = [];
            let allTasksData = [];

            // Process each workspace
            for (const workspace of workspaces) {
                try {
                    // Fetch tasks assigned to the current user in this workspace
                    // Using pagination to handle large numbers of tasks
                    let offset = null;
                    const limit = 100;

                    do {
                        // Base URL without the offset
                        let url = `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${workspace.gid}&completed_since=now&limit=${limit}&opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url`;

                        // *** Only add the offset parameter if it exists ***
                        if (offset) {
                            url += `&offset=${offset}`;
                        }

                        const tasksResponse = await ky
                            .get(url, {
                                headers: {
                                    Authorization: `Bearer ${access_token}`,
                                    Accept: 'application/json',
                                },
                            })
                            .json();

                        const tasks = tasksResponse.data || [];

                        const upsertPromises = tasks.map((task) => {
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.name,
                                    description: task.notes || null,
                                    workspace_id: payload.workspace_id,
                                    integration_source: 'asana',
                                    external_id: task.gid,
                                    external_data: task,
                                    host: 'https://app.asana.com',
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
                        allTasksData = [...allTasksData, ...tasks];

                        offset = tasksResponse.next_page ? tasksResponse.next_page.offset : null;
                    } while (offset);
                } catch (workspaceError) {
                    logger.error(`Error processing workspace ${workspace.gid}:`, workspaceError);
                    // Continue with other workspaces even if one fails
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
                            `Upsert error for task ${allTasksData[index].gid}: ${result.error.message}`,
                        );
                        taskFailCount++;
                    } else {
                        taskSuccessCount++;
                    }
                });

                logger.log(
                    `Processed ${allTasksData.length} tasks for workspace ${payload.workspace_id}: ${taskSuccessCount} succeeded, ${taskFailCount} failed`,
                );
            }

            // Check and refresh webhooks for each workspace
            // logger.log('Checking webhooks for refresh');
            // for (const workspace of workspaces) {
            //     try {
            //         // Fetch existing webhooks for this workspace
            //         const webhooksResponse = await ky
            //             .get(`https://app.asana.com/api/1.0/webhooks?workspace=${workspace.gid}`, {
            //                 headers: {
            //                     Authorization: `Bearer ${access_token}`,
            //                     Accept: 'application/json',
            //                 },
            //             })
            //             .json();
            //
            //         const webhooks = webhooksResponse.data || [];
            //         const webhookUrl = 'https://weekfuse.com/webhooks/asana';
            //
            //         // Check if our webhook exists
            //         const existingWebhook = webhooks.find(
            //             (webhook) => webhook.target === webhookUrl && webhook.resource === workspace.gid
            //         );
            //
            //         if (!existingWebhook) {
            //             // Create new webhook if it doesn't exist
            //             await ky.post('https://app.asana.com/api/1.0/webhooks', {
            //                 json: {
            //                     data: {
            //                         resource: workspace.gid,
            //                         target: webhookUrl,
            //                         filters: [
            //                             {
            //                                 resource_type: 'task',
            //                                 action: 'added'
            //                             },
            //                             {
            //                                 resource_type: 'task',
            //                                 action: 'changed'
            //                             }
            //                         ]
            //                     }
            //                 },
            //                 headers: {
            //                     Authorization: `Bearer ${access_token}`,
            //                     'Content-Type': 'application/json',
            //                 },
            //             });
            //
            //             logger.log(`Webhook created successfully for workspace ${workspace.gid}`);
            //         } else {
            //             logger.log(`Webhook already exists for workspace ${workspace.gid}`);
            //         }
            //     } catch (webhookError) {
            //         logger.error(
            //             `Error checking/creating webhook for workspace ${workspace.gid}: ${webhookError.message}`,
            //         );
            //         // Continue with other workspaces even if webhook creation fails for one
            //     }
            // }

            logger.log(
                `Successfully synced Asana integration for workspace ${payload.workspace_id}`,
            );
        } catch (error) {
            console.log(error);
            logger.error(
                `Error syncing Asana integration for workspace ${payload.workspace_id}: ${error.message}`,
            );
            return { success: false, error: error.message };
        }

        return {
            success: true,
        };
    },
});
