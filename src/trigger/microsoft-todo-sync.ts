import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky, { HTTPError } from 'ky';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

/**
 * Reusable helper to refresh the Microsoft OAuth token.
 */
const refreshToken = async ({ integration_id, refresh_token }) => {
    logger.log('Refreshing Microsoft token...', { integration_id });
    try {
        const res = await ky
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                // Microsoft's token endpoint expects form-urlencoded data
                body: new URLSearchParams({
                    client_id: process.env.MICROSOFT_TODO_CLIENT_ID as string,
                    client_secret: process.env.MICROSOFT_TODO_CLIENT_SECRET as string,
                    refresh_token: refresh_token,
                    grant_type: 'refresh_token',
                }),
                // No 'Content-Type' header needed, ky handles it for URLSearchParams
            })
            .json<any>();

        if (res.error) {
            throw new AbortTaskRunError(`Token refresh failed: ${res.error_description}`);
        }

        await supabase
            .from('user_integrations')
            .update({
                access_token: res.access_token,
                refresh_token: res.refresh_token,
                expires_at: calculateExpiresAt(res.expires_in),
                status: 'active', // Added for consistency
            })
            .eq('id', integration_id);
        logger.log('Token refreshed successfully.');

        return res;
    } catch (error) {
        if (error instanceof HTTPError) {
            const responseBody = await error.response.text();
            logger.error('Microsoft token refresh API error:', { body: responseBody });
            throw new AbortTaskRunError(
                `Token refresh failed with status ${error.response.status}. Response: ${responseBody}`,
            );
        }
        throw error;
    }
};

export const microsoftToDoSync = task({
    id: 'microsoft_todo-sync',
    maxDuration: 3600,
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({ last_sync: toUTC(), status: 'active' })
            .eq('id', payload.id);
        logger.log(`Successfully synced MS To Do integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.log(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting Microsoft To Do sync for integration ID: ${payload.id}`);
        let {
            access_token,
            refresh_token,
            id: integration_id,
            external_data,
            workspace_id,
        } = payload;

        const newDeltaLinks = external_data?.deltaLinks || {};

        const performMicrosoftToDoSync = async (currentToken: string) => {
            const headers = { Authorization: `Bearer ${currentToken}`, Accept: 'application/json' };
            const taskListsResponse = await ky
                .get('https://graph.microsoft.com/v1.0/me/todo/lists', { headers })
                .json<any>();
            const taskLists = taskListsResponse.value || [];

            if (taskLists.length === 0) {
                logger.log('No Microsoft To Do task lists found.');
                return;
            }

            // MODIFIED: Define the batch size for DB operations
            const DB_BATCH_SIZE = 50;

            for (const list of taskLists) {
                try {
                    logger.log(`Processing list: ${list.displayName} (${list.id})`);
                    let nextLink: string | null =
                        newDeltaLinks[list.id] ||
                        `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks/delta`;

                    while (nextLink) {
                        const pageResponse = await ky.get(nextLink, { headers }).json<any>();
                        const changedTasks = pageResponse.value || [];

                        // These arrays will hold all changes for the current API page
                        const deleteIds = [];
                        const upsertPayloads = [];

                        for (const task of changedTasks) {
                            if (task['@removed']) {
                                deleteIds.push(task.id);
                            } else if (task.status === 'completed') {
                                upsertPayloads.push({
                                    external_id: task.id,
                                    status: 'completed',
                                    completed_at: task.completedDateTime?.dateTime || toUTC(),
                                    workspace_id,
                                    integration_source: 'microsoft_todo',
                                    host: 'https://to-do.office.com',
                                });
                            } else {
                                upsertPayloads.push({
                                    name: task.title,
                                    description: task.body?.content || null,
                                    workspace_id,
                                    integration_source: 'microsoft_todo',
                                    external_id: task.id,
                                    external_data: { ...task, listId: list.id },
                                    host: 'https://to-do.office.com',
                                    assignee: payload.user_id,
                                    creator: payload.user_id,
                                    status: 'pending',
                                    completed_at: null,
                                });
                            }
                        }

                        // MODIFIED: Batch process all database operations
                        logger.log(
                            `Processing ${upsertPayloads.length} upserts and ${deleteIds.length} deletes from page.`,
                        );

                        // Batch upserts
                        for (let i = 0; i < upsertPayloads.length; i += DB_BATCH_SIZE) {
                            const batch = upsertPayloads.slice(i, i + DB_BATCH_SIZE);
                            await supabase.from('tasks').upsert(batch, {
                                onConflict: 'integration_source, external_id, host, workspace_id',
                            });
                        }

                        // Batch deletes
                        for (let i = 0; i < deleteIds.length; i += DB_BATCH_SIZE) {
                            const batch = deleteIds.slice(i, i + DB_BATCH_SIZE);
                            await supabase.from('tasks').delete().in('external_id', batch);
                        }

                        // Delta link logic remains the same
                        if (pageResponse['@odata.deltaLink']) {
                            newDeltaLinks[list.id] = pageResponse['@odata.deltaLink'];
                            nextLink = null;
                        } else {
                            nextLink = pageResponse['@odata.nextLink'] || null;
                        }
                    }
                } catch (listError) {
                    logger.error(`Failed to process list ${list.id}:`, listError);
                }
            }
        };

        try {
            // Token refresh and retry logic (unchanged)
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                const newTokens = await refreshToken({ integration_id, refresh_token });
                access_token = newTokens.access_token;
            }
            try {
                await performMicrosoftToDoSync(access_token);
            } catch (error) {
                if (error instanceof HTTPError && error.response.status === 401) {
                    if (!refresh_token) throw new AbortTaskRunError('No refresh_token available.');
                    const newTokens = await refreshToken({ integration_id, refresh_token });
                    await performMicrosoftToDoSync(newTokens.access_token);
                } else {
                    throw error;
                }
            }

            // MODIFIED: Return the collected delta links so onSuccess can save them
            return { success: true, deltaLinks: newDeltaLinks };
        } catch (error) {
            logger.error(`Error syncing MS To Do integration ID ${payload.id}:`, error);
            throw error;
        }
    },
});
