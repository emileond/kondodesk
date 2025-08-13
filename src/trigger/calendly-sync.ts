// filename: jobs/calendlySync.ts
import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky, { HTTPError } from 'ky';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

/**
 * Refreshes an expired Calendly access token.
 */
const refreshToken = async ({ integration_id, refresh_token }) => {
    logger.log('Refreshing Calendly token...', { integration_id });
    try {
        const credentials = `${process.env.CALENDLY_CLIENT_ID}:${process.env.CALENDLY_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        const res = await ky
            .post('https://auth.calendly.com/oauth/token', {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${encodedCredentials}`,
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refresh_token,
                }),
            })
            .json<any>();

        if (res.error) {
            throw new AbortTaskRunError(
                `Token refresh failed: ${res.error_description || res.error}`,
            );
        }

        await supabase
            .from('user_integrations')
            .update({
                access_token: res.access_token,
                refresh_token: res.refresh_token,
                expires_at: calculateExpiresAt(res.expires_in - 600), // Refresh 10 mins before expiry
                status: 'active',
            })
            .eq('id', integration_id);

        logger.log('Calendly token refreshed successfully.');
        return res;
    } catch (error) {
        if (error instanceof HTTPError) {
            const responseBody = await error.response.text();
            logger.error('Calendly token refresh API error:', { body: responseBody });
            throw new AbortTaskRunError(
                `Token refresh failed with status ${error.response.status}. Response: ${responseBody}`,
            );
        }
        // Re-throw other errors to be caught by the main task runner
        throw error;
    }
};

export const calendlySync = task({
    id: 'calendly-sync',
    maxDuration: 3600, // 1 hour
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({ last_sync: toUTC(), status: 'active' })
            .eq('id', payload.id);
        logger.log(`Successfully synced Calendly integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        // If the refresh token itself is invalid, mark it for re-authentication
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.error(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting Calendly sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token, id: integration_id, workspace_id, user_id } = payload;

        const performSync = async (currentToken: string) => {
            const headers = { Authorization: `Bearer ${currentToken}` };

            // 1. Get current user's URI
            const userData = await ky
                .get('https://api.calendly.com/users/me', { headers })
                .json<any>();
            const userUri = userData.resource.uri;

            // 2. Upsert the single "calendar" for this Calendly user
            const { data: calData, error: calError } = await supabase
                .from('calendars')
                .upsert(
                    {
                        integration_id,
                        name: userData.resource.slug, // Using slug as a consistent name
                        external_id: userData.resource.uri, // Using slug as a consistent name
                        source: 'calendly',
                        is_enabled: true,
                        workspace_id,
                        user_id,
                    },
                    { onConflict: 'integration_id, external_id, source, workspace_id, user_id' },
                )
                .select('id')
                .single();

            if (calError) throw new Error(`Failed to upsert calendar: ${calError.message}`);
            const calendar_id = calData.id;

            // 3. Fetch and sync all events with pagination
            let nextLink: string | null =
                `https://api.calendly.com/scheduled_events?user=${userUri}&status=active&count=50`;

            while (nextLink) {
                const page = await ky.get(nextLink, { headers }).json<any>();
                const events = page.collection || [];

                if (events.length > 0) {
                    const eventUpserts = events.map((ev: any) => ({
                        calendar_id,
                        external_id: ev.uri,
                        title: ev.name || null,
                        description: ev?.meeting_notes_html || null,
                        start_time: ev.start_time,
                        end_time: ev.end_time,
                        source: 'calendly',
                        web_link: ev.uri, // The event URI is its web link
                        location_label: ev.location?.location || ev.location?.join_url,
                        workspace_id,
                        user_id,
                    }));

                    const { error: upsertError } = await supabase
                        .from('events')
                        .upsert(eventUpserts, {
                            onConflict: 'calendar_id, external_id, source, workspace_id, user_id',
                        });

                    if (upsertError) {
                        logger.error('Failed to batch upsert Calendly events', {
                            error: upsertError,
                        });
                        // Continue to next page rather than failing the whole sync
                    }
                }

                nextLink = page?.pagination?.next_page || null;
            }
        };

        try {
            // Check for token expiry before the first API call
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired) {
                if (!refresh_token)
                    throw new AbortTaskRunError('Token expired and no refresh_token available.');
                const newTokens = await refreshToken({ integration_id, refresh_token });
                access_token = newTokens.access_token;
            }

            // Perform the main sync logic, with a retry mechanism for 401 errors
            try {
                await performSync(access_token);
            } catch (error) {
                if (error instanceof HTTPError && error.response.status === 401) {
                    logger.warn(
                        'Initial access token was invalid, attempting refresh and retry...',
                    );
                    if (!refresh_token)
                        throw new AbortTaskRunError(
                            'Access token invalid and no refresh_token available.',
                        );

                    const newTokens = await refreshToken({ integration_id, refresh_token });
                    await performSync(newTokens.access_token); // Retry sync with new token
                } else {
                    // Re-throw other errors
                    throw error;
                }
            }

            return { success: true, message: 'Sync complete' };
        } catch (error) {
            logger.error(`Error during Calendly sync for integration ID ${payload.id}:`, error);
            // Throwing the error will cause the task to fail and trigger the onFailure hook
            throw error;
        }
    },
});
