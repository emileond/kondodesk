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

/**
 * Checks if a webhook exists for a user's task list and creates one if not.
 */
async function ensureWebhookExists(
    headers: { Authorization: string },
    workspaceGid: string,
    userGid: string,
    integrationId: string,
) {
    try {
        // 1. Get the GID for the user's task list in this workspace
        const utlResponse = await ky
            .get(
                `https://app.asana.com/api/1.0/users/${userGid}/user_task_list?workspace=${workspaceGid}`,
                { headers },
            )
            .json<any>();
        const userTaskListGid = utlResponse.data?.gid;

        if (!userTaskListGid) {
            logger.warn(
                `Could not find user task list for user ${userGid} in workspace ${workspaceGid}.`,
            );
            return;
        }

        // 2. Check for existing webhooks in the workspace
        const webhooksResponse = await ky
            .get(`https://app.asana.com/api/1.0/webhooks?workspace=${workspaceGid}`, { headers })
            .json<any>();

        const expectedTarget = `https://weekfuse.com/webhooks/asana?integration_id=${integrationId}`;
        const webhookExists = webhooksResponse.data.some(
            (hook: any) =>
                hook.resource.gid === userTaskListGid &&
                hook.target === expectedTarget &&
                hook.active,
        );

        // 3. If no active webhook is found, create one
        if (!webhookExists) {
            logger.log(`Webhook not found for user task list ${userTaskListGid}. Creating one...`);
            await ky.post('https://app.asana.com/api/1.0/webhooks', {
                headers: { ...headers, 'Content-Type': 'application/json' },
                json: {
                    data: {
                        resource: userTaskListGid,
                        target: expectedTarget,
                        filters: [
                            { resource_type: 'task', action: 'added' },
                            { resource_type: 'task', action: 'changed' },
                            { resource_type: 'task', action: 'deleted' },
                        ],
                    },
                },
            });
            logger.log('Webhook created successfully.');
        } else {
            logger.log(`Active webhook for user task list ${userTaskListGid} already exists.`);
        }
    } catch (error) {
        logger.error('Failed to ensure webhook existence.', { workspaceGid, error });
    }
}

export const asanaSync = task({
    id: 'asana-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log(`Starting Asana sync for integration ID: ${payload.id}`);
        let { access_token } = payload;

        try {
            // 1. Refresh token if it's expired
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && payload.refresh_token) {
                logger.log('Asana token expired, refreshing...');
                const res = await ky
                    .post('https://app.asana.com/-/oauth_token', {
                        body: new URLSearchParams({
                            grant_type: 'refresh_token',
                            client_id: process.env.ASANA_CLIENT_ID,
                            client_secret: process.env.ASANA_CLIENT_SECRET,
                            refresh_token: payload.refresh_token,
                        }),
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

            // 2. Fetch workspaces
            const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };
            const workspacesResponse = await ky
                .get('https://app.asana.com/api/1.0/workspaces', { headers })
                .json<any>();
            const workspaces = workspacesResponse.data || [];
            if (workspaces.length === 0) {
                logger.error('No accessible Asana workspaces found.');
                return { success: true, message: 'No workspaces found.' };
            }

            const DB_BATCH_SIZE = 50;
            const userGid = payload.external_data?.gid;

            // 3. Process each workspace individually
            for (const workspace of workspaces) {
                logger.log(`Processing workspace: ${workspace.name} (${workspace.gid})`);

                // 3a. Ensure webhook is active for this workspace's user task list
                if (userGid) {
                    await ensureWebhookExists(headers, workspace.gid, userGid, payload.id);
                }

                // 3b. Sync tasks with pagination and batching
                let totalTasksProcessed = 0;
                let next_page_path: string | null =
                    `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${workspace.gid}&completed_since=now&limit=100&opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url`;

                while (next_page_path) {
                    const tasksResponse = await ky.get(next_page_path, { headers }).json<any>();
                    const tasks = tasksResponse.data || [];

                    if (tasks.length > 0) {
                        for (let i = 0; i < tasks.length; i += DB_BATCH_SIZE) {
                            const batch = tasks.slice(i, i + DB_BATCH_SIZE);
                            const upsertPromises = batch.map((task) =>
                                supabase.from('tasks').upsert(
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
                        totalTasksProcessed += tasks.length;
                    }
                    next_page_path = tasksResponse.next_page?.path || null;
                }
                logger.log(
                    `Processed ${totalTasksProcessed} tasks from workspace ${workspace.name}.`,
                );
            }

            // 4. Update final sync status
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                    status: 'active',
                })
                .eq('id', payload.id);
            logger.log(`Successfully synced Asana integration for ID: ${payload.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing Asana integration ID ${payload.id}:`, error);
            await supabase
                .from('user_integrations')
                .update({ status: 'error' })
                .eq('id', payload.id);
            return { success: false, error: error.message };
        }
    },
});
