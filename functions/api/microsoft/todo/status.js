import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle POST requests to update Microsoft To Do task status
export async function onRequestPost(context) {
    try {
        // Get the request body
        const { task_id, taskId, listId, status, user_id, workspace_id } =
            await context.request.json();

        console.log(
            'task:',
            task_id,
            'taskId:',
            taskId,
            'listId:',
            listId,
            'status:',
            status,
            'user:',
            user_id,
            'workspace:',
            workspace_id,
        );

        if (!task_id || !taskId || !listId || !status || !user_id || !workspace_id) {
            return Response.json(
                {
                    success: false,
                    error: 'Missing required parameters',
                },
                { status: 400 },
            );
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at, external_data')
            .eq('type', 'microsoft_todo')
            .eq('status', 'active')
            .eq('user_id', user_id)
            .eq('workspace_id', workspace_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                {
                    success: false,
                    error: 'Microsoft To Do integration not found',
                    details: integrationError,
                },
                { status: 404 },
            );
        }

        // Check if token has expired
        const currentTime = dayjs().utc();
        const tokenExpired =
            !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));

        let accessToken = integration.access_token;
        let refreshToken = integration.refresh_token;

        // Only refresh token if it has expired
        if (tokenExpired) {
            console.log('Access token expired, refreshing');

            // Refresh token
            const newToken = await ky
                .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                    body: new URLSearchParams({
                        client_id: context.env.MICROSOFT_CLIENT_ID,
                        client_secret: context.env.MICROSOFT_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                        scope: 'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read offline_access',
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                })
                .json();

            if (!newToken) {
                return Response.json(
                    {
                        success: false,
                        error: 'Unable to refresh token',
                    },
                    { status: 401 },
                );
            }

            // Update token information
            accessToken = newToken.access_token;
            refreshToken = newToken.refresh_token;
            const expiresAt = calculateExpiresAt(newToken.expires_in);

            // Update the database with new token information
            await supabase
                .from('user_integrations')
                .update({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_at: expiresAt,
                })
                .eq('type', 'microsoft_todo')
                .eq('status', 'active')
                .eq('user_id', user_id)
                .eq('workspace_id', workspace_id);
        }

        // Update the task status in Microsoft To Do
        const updatePayload = {
            status: status, // 'notStarted', 'inProgress', 'completed'
        };

        // If marking as completed, add completion date
        if (status === 'completed') {
            updatePayload.completedDateTime = {
                dateTime: new Date().toISOString(),
                timeZone: 'UTC',
            };
        }

        await ky.patch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${taskId}`, {
            json: updatePayload,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });

        // Update the task in Supabase if needed
        const { data: task, error: selectError } = await supabase
            .from('tasks')
            .select('external_data')
            .eq('id', task_id)
            .single();

        if (!selectError && task) {
            // Fetch the updated task to get the new status
            const updatedTask = await ky
                .get(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${taskId}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                    },
                })
                .json();

            const updatedExternalData = {
                ...task.external_data,
                status: updatedTask.status,
                completedDateTime: updatedTask.completedDateTime,
            };

            await supabase
                .from('tasks')
                .update({ external_data: updatedExternalData })
                .eq('id', task_id)
                .eq('integration_source', 'microsoft_todo');
        }

        return Response.json({
            success: true,
            message: `Microsoft To Do task status updated successfully`,
        });
    } catch (error) {
        let errorMessage = 'An unexpected error occurred while contacting Microsoft To Do.';
        let statusCode = 500; // Default to internal server error

        // Check if this is an HTTPError from ky with a response object
        if (error.response) {
            // It's better to respond with a 400/422 if it's a user error, not 500
            statusCode = 400;
            try {
                const errorBody = await error.response.json();
                console.error('Microsoft To Do API Error Body:', errorBody);

                // Extract the specific error messages from Microsoft's response
                if (errorBody.error && errorBody.error.message) {
                    errorMessage = errorBody.error.message;
                } else if (errorBody.message) {
                    errorMessage = errorBody.message;
                }
            } catch (e) {
                errorMessage = 'Failed to update task status and could not parse error response.';
            }
        } else {
            // This is a network error or some other unexpected issue
            console.error('Non-Microsoft To Do Error in onRequestPost:', error);
        }

        // Return a response with the specific error message from Microsoft To Do
        return Response.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: statusCode },
        );
    }
}
