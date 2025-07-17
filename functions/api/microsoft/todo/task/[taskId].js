import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateExpiresAt } from '../../../../../src/utils/dateUtils.js';

// This function will handle GET requests for a single Microsoft To Do task
export async function onRequestGet(context) {
    try {
        const { taskId } = context.params;
        const url = new URL(context.request.url);
        const workspace_id = url.searchParams.get('workspace_id');
        const user_id = url.searchParams.get('user_id');
        const listId = url.searchParams.get('listId');

        if (!taskId || !workspace_id || !user_id || !listId) {
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
            .eq('type', 'microsoft_todo')
            .eq('status', 'active')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            return Response.json(
                { success: false, error: 'Microsoft To Do integration not found' },
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
                .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        client_id: context.env.MICROSOFT_TODO_CLIENT_ID,
                        client_secret: context.env.MICROSOFT_TODO_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                        scope: 'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read offline_access',
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                })
                .json();
            
            accessToken = newToken.access_token;
            await supabase
                .from('user_integrations')
                .update({
                    access_token: newToken.access_token,
                    refresh_token: newToken.refresh_token,
                    expires_at: calculateExpiresAt(newToken.expires_in),
                })
                .match({ user_id, workspace_id, type: 'microsoft_todo' });
        }
        // --- End Token Refresh Logic ---

        // Fetch the task details from Microsoft Graph API
        const taskDetails = await ky
            .get(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${taskId}`, {
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
        console.error('Error fetching Microsoft To Do task:', error);
        return Response.json(
            { success: false, error: 'Internal server error', details: error.message },
            { status: 500 },
        );
    }
}