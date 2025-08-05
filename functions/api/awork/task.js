import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';
import dayjs from 'dayjs';
import ky from 'ky';

export async function onRequestPatch(context) {
    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the request body
        const { external_id, taskStatusType, user_id } = await context.request.json();

        if (!external_id || !taskStatusType || !user_id) {
            return Response.json(
                {
                    success: false,
                    error: 'Missing required parameters',
                },
                { status: 400 },
            );
        }

        // Validate taskStatusType value
        const validStatuses = ['new', 'progress', 'review', 'done'];
        if (!validStatuses.includes(taskStatusType)) {
            return Response.json(
                {
                    success: false,
                    error: 'Invalid taskStatusType value.',
                },
                { status: 400 },
            );
        }

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('id, access_token, refresh_token, expires_at')
            .eq('type', 'awork')
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            console.log(integrationError);
            return Response.json(integrationError, { status: 404 });
        }

        // Check if token has expired
        const currentTime = dayjs().utc();
        const tokenExpired = !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));

        let access_token = integration.access_token;
        let refresh_token = integration.refresh_token;

        // Only refresh token if it has expired
        if (tokenExpired && refresh_token) {
            console.log('Access token expired, refreshing');

            const res = await ky
                .post('https://api.awork.com/oauth2/token', {
                    json: {
                        client_id: context.env.AWORK_CLIENT_ID,
                        client_secret: context.env.AWORK_CLIENT_SECRET,
                        grant_type: 'refresh_token',
                        refresh_token: integration.refresh_token,
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                })
                .json();

            if (res.error) {
                console.log(res);
                await supabase
                    .from('user_integrations')
                    .update({
                        status: 'error',
                    })
                    .eq('id', integration.id);

                return Response.json(res, { status: 400 });
            }

            // Update token information
            access_token = res.access_token;
            refresh_token = res.refresh_token;
            const expires_at = calculateExpiresAt(res.expires_in);

            // Update integration access_token, refresh_token, expires_at and the last_sync timestamp
            await supabase
                .from('user_integrations')
                .update({
                    access_token,
                    refresh_token,
                    expires_at,
                    last_sync: toUTC(),
                })
                .eq('id', integration.id);
        }

        // Update the task status in Awork
        const response = await ky.patch(`https://api.awork.com/api/v1/tasks/${external_id}`, {
            json: { taskStatusType: taskStatusType },
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.status !== 200) {
            console.log(response);
            return Response.json(
                {
                    success: false,
                    error: 'Failed to update Awork task',
                    details: response.data,
                },
                { status: response.status },
            );
        }

        // Update the task in Supabase with the new status
        const { data: task, error: selectError } = await supabase
            .from('tasks')
            .select('external_data')
            .eq('external_id', external_id)
            .single();

        if (selectError) {
            console.log(selectError);
            return Response.json(
                {
                    success: false,
                    error: 'Failed to find task in database',
                    details: selectError,
                },
                { status: 500 },
            );
        }

        const updatedExternalData = {
            ...task.external_data,
            taskStatusType: taskStatusType,
        };

        const { error: updateError } = await supabase
            .from('tasks')
            .update({ external_data: updatedExternalData })
            .eq('external_id', external_id)
            .eq('integration_source', 'awork');

        if (updateError) {
            console.log(updateError);
            return Response.json(
                {
                    success: false,
                    error: 'Failed to update task in database',
                    details: updateError,
                },
                { status: 500 },
            );
        }

        return Response.json({
            success: true,
            message: `Awork task status updated to ${taskStatusType}`,
        });
    } catch (error) {
        console.log('Error updating Awork task:', error);
        return Response.json(error, { status: 500 });
    }
}