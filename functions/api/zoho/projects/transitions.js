import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle GET requests to fetch task statuses for a Zoho Projects task
export async function onRequestGet(context) {
    try {
        // Get the task ID from the URL
        const url = new URL(context.request.url);
        const taskId = url.searchParams.get('taskId');
        const projectId = url.searchParams.get('projectId');

        if (!taskId || !projectId) {
            return Response.json(
                {
                    success: false,
                    error: 'Missing taskId or projectId parameter',
                },
                { status: 400 },
            );
        }

        const workspace_id = url.searchParams.get('workspace_id');
        const user_id = url.searchParams.get('user_id');

        if (!workspace_id || !user_id) {
            return Response.json(
                {
                    success: false,
                    error: 'Missing parameters',
                },
                { status: 400 },
            );
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at')
            .eq('type', 'zoho_projects')
            .eq('status', 'active')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                {
                    success: false,
                    error: 'Zoho Projects integration not found',
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
                .post('https://accounts.zoho.com/oauth/v2/token', {
                    json: {
                        client_id: context.env.ZOHO_PROJECTS_CLIENT_ID,
                        client_secret: context.env.ZOHO_PROJECTS_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                    },
                    headers: {
                        Accept: 'application/json',
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
                .eq('type', 'zoho_projects')
                .eq('status', 'active')
                .eq('user_id', user_id)
                .eq('workspace_id', workspace_id);
        }

        // Fetch available task statuses from the project
        const statusesResponse = await ky
            .get(
                `https://projectsapi.zoho.com/restapi/projects/${projectId}/statuses/`,
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                        Accept: 'application/json',
                    },
                },
            )
            .json();

        return Response.json({
            success: true,
            statuses: statusesResponse.statuses || [],
        });
    } catch (error) {
        console.error('Error fetching Zoho Projects task statuses:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
                details: error.message,
            },
            { status: 500 },
        );
    }
}

// Handle POST requests to update a Zoho Projects task status
export async function onRequestPost(context) {
    try {
        // Get the request body
        const { task_id, taskId, projectId, statusId, user_id, workspace_id } =
            await context.request.json();

        console.log(
            'task:',
            task_id,
            'zohoTaskId:',
            taskId,
            'projectId:',
            projectId,
            'statusId:',
            statusId,
            'user:',
            user_id,
            'workspace:',
            workspace_id,
        );

        if (
            !task_id ||
            !taskId ||
            !projectId ||
            !statusId ||
            !user_id ||
            !workspace_id
        ) {
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
            .eq('type', 'zoho_projects')
            .eq('status', 'active')
            .eq('user_id', user_id)
            .eq('workspace_id', workspace_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                {
                    success: false,
                    error: 'Zoho Projects integration not found',
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
                .post('https://accounts.zoho.com/oauth/v2/token', {
                    json: {
                        client_id: context.env.ZOHO_PROJECTS_CLIENT_ID,
                        client_secret: context.env.ZOHO_PROJECTS_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                        grant_type: 'refresh_token',
                    },
                    headers: {
                        Accept: 'application/json',
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
                .eq('type', 'zoho_projects')
                .eq('status', 'active')
                .eq('user_id', user_id)
                .eq('workspace_id', workspace_id);
        }

        // Update the task status in Zoho Projects
        const updatePayload = {
            status: statusId,
        };

        await ky.post(
            `https://projectsapi.zoho.com/restapi/projects/${projectId}/tasks/${taskId}/`,
            {
                json: updatePayload,
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            },
        );

        // Update the task in Supabase if needed
        const { data: task, error: selectError } = await supabase
            .from('tasks')
            .select('external_data')
            .eq('id', task_id)
            .single();

        if (!selectError && task) {
            // Fetch the updated task to get the new status
            const updatedTask = await ky
                .get(
                    `https://projectsapi.zoho.com/restapi/projects/${projectId}/tasks/${taskId}/`,
                    {
                        headers: {
                            Authorization: `Zoho-oauthtoken ${accessToken}`,
                            Accept: 'application/json',
                        },
                    },
                )
                .json();

            const updatedExternalData = {
                ...task.external_data,
                status: updatedTask.tasks?.[0]?.status || updatedTask.status,
            };

            await supabase
                .from('tasks')
                .update({ external_data: updatedExternalData })
                .eq('id', task_id)
                .eq('integration_source', 'zoho_projects');
        }

        return Response.json({
            success: true,
            message: `Zoho Projects task status updated successfully`,
        });
    } catch (error) {
        let errorMessage = 'An unexpected error occurred while contacting Zoho Projects.';
        let statusCode = 500; // Default to internal server error

        // Check if this is an HTTPError from ky with a response object
        if (error.response) {
            // It's better to respond with a 400/422 if it's a user error, not 500
            statusCode = 400;
            try {
                const errorBody = await error.response.json();
                console.error('Zoho Projects API Error Body:', errorBody);

                // Extract the specific error messages from Zoho's response
                if (errorBody.error) {
                    errorMessage = errorBody.error.message || errorBody.error;
                } else if (errorBody.message) {
                    errorMessage = errorBody.message;
                }
            } catch (e) {
                errorMessage = 'Failed to update task status and could not parse error response.';
            }
        } else {
            // This is a network error or some other unexpected issue
            console.error('Non-Zoho Error in onRequestPost:', error);
        }

        // Return a response with the specific error message from Zoho
        return Response.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: statusCode },
        );
    }
}