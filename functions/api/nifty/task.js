import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';
import dayjs from 'dayjs';
import ky from 'ky';

export async function onRequestPatch(context) {
    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Get the request body
        const { external_id, state, user_id } = await context.request.json();

        if (!external_id || !state || !user_id) {
            return Response.json(
                {
                    success: false,
                    error: 'Missing required parameters',
                },
                { status: 400 },
            );
        }

        // Validate state value
        if (state !== 'completed' && state !== 'pending') {
            return Response.json(
                {
                    success: false,
                    error: 'Invalid state value.',
                },
                { status: 400 },
            );
        }

        // Get the workspace integration to get the access_token
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('id, access_token, refresh_token, expires_at')
            .eq('type', 'nifty')
            .eq('user_id', user_id)
            .single();

        if (integrationError || !integration) {
            console.log(integrationError);
            return Response.json(integrationError, { status: 404 });
        }

        // Check if token has expired
        const currentTime = dayjs().utc();
        const tokenExpired =
            !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));

        let access_token = integration.access_token;
        let refresh_token = integration.refresh_token;

        // Only refresh token if it has expired
        if (tokenExpired && refresh_token) {
            console.log('Access token expired, refreshing');

            const res = await ky
                .post('https://openapi.niftypm.com/oauth/token', {
                    json: {
                        grant_type: 'refresh_token',
                        client_id: context.env.NIFTY_CLIENT_ID,
                        client_secret: context.env.NIFTY_CLIENT_SECRET,
                        refresh_token: integration.refresh_token,
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
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

        // Map state to Nifty status
        const niftyStatus = state === 'completed' ? 'completed' : 'open';

        // Update the task status in Nifty
        const response = await ky.patch(
            `https://openapi.niftypm.com/api/v1.0/tasks/${external_id}`,
            {
                json: {
                    completed: state === 'completed',
                },
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            },
        );

        if (response.status !== 200) {
            console.log(response);
            return Response.json(
                {
                    success: false,
                    error: 'Failed to update Nifty task',
                    details: response.data,
                },
                { status: response.status },
            );
        }

        // Update the task in Supabase with the new state
        const { data: task, error: selectError } = await supabase
            .from('tasks')
            .select('external_data')
            .eq('external_id', external_id)
            .single();

        const updatedExternalData = {
            ...task.external_data,
            completed: state === 'completed',
        };

        const { error: updateError } = await supabase
            .from('tasks')
            .update({ external_data: updatedExternalData })
            .eq('external_id', external_id)
            .eq('integration_source', 'nifty');

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
            message: `Nifty task status updated to ${state}`,
        });
    } catch (error) {
        console.log('Error updating Nifty task:', error);
        return Response.json(error, { status: 500 });
    }
}
