import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// This function will handle GET requests for a single Google Tasks task
export async function onRequestGet(context) {
    try {
        const { taskId } = context.params;
        const url = new URL(context.request.url);
        const workspace_id = url.searchParams.get('workspace_id');
        const user_id = url.searchParams.get('user_id');
        const taskListId = url.searchParams.get('taskListId');

        if (!taskId || !workspace_id || !user_id || !taskListId) {
            return Response.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 },
            );
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at')
            .eq('type', 'google_tasks')
            .eq('status', 'active')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                { success: false, error: 'Google Tasks integration not found' },
                { status: 404 },
            );
        }

        // --- Token Refresh Logic ---
        const currentTime = dayjs().utc();
        const tokenExpired =
            !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));
        let accessToken = integration.access_token;

        if (tokenExpired) {
            const newToken = await ky
                .post('https://oauth2.googleapis.com/token', {
                    json: {
                        grant_type: 'refresh_token',
                        client_id: context.env.GOOGLE_OAUTH_CLIENT_ID,
                        client_secret: context.env.GOOGLE_OAUTH_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                    },
                })
                .json();
            
            accessToken = newToken.access_token;
            await supabase
                .from('user_integrations')
                .update({
                    access_token: newToken.access_token,
                    refresh_token: newToken.refresh_token || integration.refresh_token,
                    expires_at: calculateExpiresAt(newToken.expires_in),
                })
                .match({ user_id, workspace_id, type: 'google_tasks' });
        }
        // --- End Token Refresh Logic ---

        // Fetch the task details from Google Tasks API
        const taskDetails = await ky
            .get(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
                headers: { 
                    Authorization: `Bearer ${accessToken}`, 
                    Accept: 'application/json' 
                },
            })
            .json();

        return Response.json({
            success: true,
            task: taskDetails,
        });
    } catch (error) {
        console.error('Error fetching Google Tasks task:', error);
        return Response.json(
            { success: false, error: 'Internal server error', details: error.message },
            { status: 500 },
        );
    }
}

// This function will handle PATCH requests to update a Google Tasks task
export async function onRequestPatch(context) {
    try {
        const { taskId } = context.params;
        const body = await context.request.json();
        const { workspace_id, user_id, taskListId, status, completed } = body;

        if (!taskId || !workspace_id || !user_id || !taskListId) {
            return Response.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 },
            );
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at')
            .eq('type', 'google_tasks')
            .eq('status', 'active')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                { success: false, error: 'Google Tasks integration not found' },
                { status: 404 },
            );
        }

        // --- Token Refresh Logic ---
        const currentTime = dayjs().utc();
        const tokenExpired =
            !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));
        let accessToken = integration.access_token;

        if (tokenExpired) {
            const newToken = await ky
                .post('https://oauth2.googleapis.com/token', {
                    json: {
                        grant_type: 'refresh_token',
                        client_id: context.env.GOOGLE_OAUTH_CLIENT_ID,
                        client_secret: context.env.GOOGLE_OAUTH_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                    },
                })
                .json();
            
            accessToken = newToken.access_token;
            await supabase
                .from('user_integrations')
                .update({
                    access_token: newToken.access_token,
                    refresh_token: newToken.refresh_token || integration.refresh_token,
                    expires_at: calculateExpiresAt(newToken.expires_in),
                })
                .match({ user_id, workspace_id, type: 'google_tasks' });
        }
        // --- End Token Refresh Logic ---

        // Prepare the update payload for Google Tasks API
        const updatePayload = {};
        
        // Handle status/completion updates
        if (status !== undefined) {
            if (status === 'completed') {
                updatePayload.status = 'completed';
                updatePayload.completed = new Date().toISOString();
            } else {
                updatePayload.status = 'needsAction';
                updatePayload.completed = null;
            }
        } else if (completed !== undefined) {
            if (completed) {
                updatePayload.status = 'completed';
                updatePayload.completed = new Date().toISOString();
            } else {
                updatePayload.status = 'needsAction';
                updatePayload.completed = null;
            }
        }

        // Update the task in Google Tasks API
        const updatedTask = await ky
            .patch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
                headers: { 
                    Authorization: `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json' 
                },
                json: updatePayload,
            })
            .json();

        // Update the task in our local database
        await supabase
            .from('tasks')
            .update({
                external_data: updatedTask,
                status: updatedTask.status === 'completed' ? 'completed' : 'pending',
                completed_at: updatedTask.status === 'completed' ? updatedTask.completed : null,
            })
            .eq('external_id', taskId)
            .eq('integration_source', 'google_tasks')
            .eq('workspace_id', workspace_id);

        return Response.json({
            success: true,
            task: updatedTask,
        });
    } catch (error) {
        console.error('Error updating Google Tasks task:', error);
        return Response.json(
            { success: false, error: 'Internal server error', details: error.message },
            { status: 500 },
        );
    }
}