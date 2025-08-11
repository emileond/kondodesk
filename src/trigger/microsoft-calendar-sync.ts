import { logger, task, AbortTaskRunError } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { toUTC, calculateExpiresAt } from '../utils/dateUtils';
import ky, { HTTPError } from 'ky';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

const refreshToken = async ({ integration_id, refresh_token }) => {
    logger.log('Refreshing Microsoft token...', { integration_id });
    try {
        const res = await ky
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                body: new URLSearchParams({
                    client_id: process.env.MICROSOFT_CLIENT_ID as string,
                    client_secret: process.env.MICROSOFT_CLIENT_SECRET as string,
                    refresh_token: refresh_token,
                    grant_type: 'refresh_token',
                }),
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
                status: 'active',
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

export const microsoftCalendarSync = task({
    id: 'microsoft_calendar-sync',
    maxDuration: 3600,
    onSuccess: async (payload) => {
        await supabase
            .from('user_integrations')
            .update({ last_sync: toUTC(), status: 'active' })
            .eq('id', payload.id);
        logger.log(`Successfully synced MS Calendar integration for ID: ${payload.id}`);
    },
    onFailure: async (payload) => {
        await supabase.from('user_integrations').update({ status: 'error' }).eq('id', payload.id);
        logger.log(`Failed to sync, status changed to error for integration: ${payload.id}`);
    },
    run: async (payload: any) => {
        logger.log(`Starting Microsoft Calendar sync for integration ID: ${payload.id}`);
        let { access_token, refresh_token, id: integration_id, workspace_id, user_id } = payload;

        const performSync = async (currentToken: string) => {
            const headers = { Authorization: `Bearer ${currentToken}`, Accept: 'application/json' };

            // Fetch calendars
            const cals = await ky.get(`${GRAPH_BASE}/me/calendars`, { headers }).json<any>();

            const calendars = cals.value?.filter((cal) => cal.canShare) || [];

            // Upsert calendars in batches
            const DB_BATCH_SIZE = 50;
            for (let i = 0; i < calendars.length; i += DB_BATCH_SIZE) {
                const batch = calendars.slice(i, i + DB_BATCH_SIZE);
                await Promise.all(
                    batch.map((cal) =>
                        supabase.from('calendars').upsert(
                            {
                                integration_id,
                                external_id: cal.id,
                                name: cal.name,
                                color: cal.color || null,
                                source: 'microsoft_calendar',
                                is_enabled: true,
                                workspace_id,
                                user_id,
                            },
                            {
                                onConflict:
                                    'integration_id, external_id, source, workspace_id, user_id',
                            },
                        ),
                    ),
                );
            }

            // Build calendar id map
            const { data: dbCalendars } = await supabase
                .from('calendars')
                .select('id, external_id')
                .eq('integration_id', integration_id)
                .eq('source', 'microsoft_calendar')
                .eq('workspace_id', workspace_id)
                .eq('user_id', user_id);
            const calendarIdMap = new Map((dbCalendars || []).map((c) => [c.external_id, c.id]));

            // Fetch events per calendar and upsert
            for (const cal of calendars) {
                try {
                    let nextLink: string | null =
                        `${GRAPH_BASE}/me/calendars/${cal.id}/events?$top=50`;
                    while (nextLink) {
                        const page = await ky.get(nextLink, { headers }).json<any>();
                        const events = page.value || [];

                        console.log(events);

                        for (let i = 0; i < events.length; i += DB_BATCH_SIZE) {
                            const batch = events.slice(i, i + DB_BATCH_SIZE);
                            await Promise.all(
                                batch.map((ev) =>
                                    supabase.from('events').upsert(
                                        {
                                            calendar_id: calendarIdMap.get(cal.id),
                                            external_id: ev.id,
                                            title: ev.subject || null,
                                            description: ev.body?.content || null,
                                            start_time: ev.start?.dateTime || null,
                                            end_time: ev.end?.dateTime || null,
                                            is_all_day: !!ev.isAllDay,
                                            source: 'microsoft_calendar',
                                            web_link: ev?.webLink || null,
                                            meeting_url:
                                                ev?.onlineMeetingUrl ||
                                                ev?.onlineMeeting?.joinUrl ||
                                                null,
                                            location_label: ev.location?.displayName || null,
                                            location_address: ev.location?.address?.street || null,
                                            location_uri: ev.location?.locationUri || null,
                                            location_coordinates: ev.location?.coordinates || null,
                                            workspace_id,
                                            user_id,
                                        },
                                        {
                                            onConflict:
                                                'calendar_id, external_id, source, workspace_id, user_id',
                                        },
                                    ),
                                ),
                            );
                        }

                        nextLink = page['@odata.nextLink'] || null;
                    }
                } catch (err) {
                    logger.error(`Failed syncing events for calendar ${cal.id}:`, err);
                }
            }
        };

        try {
            const tokenExpired =
                !payload.expires_at || dayjs().utc().isAfter(dayjs(payload.expires_at));
            if (tokenExpired && refresh_token) {
                const newTokens = await refreshToken({ integration_id, refresh_token });
                access_token = newTokens.access_token;
            }
            try {
                await performSync(access_token);
            } catch (error) {
                if (error instanceof HTTPError && error.response.status === 401) {
                    if (!refresh_token) throw new AbortTaskRunError('No refresh_token available.');
                    const newTokens = await refreshToken({ integration_id, refresh_token });
                    await performSync(newTokens.access_token);
                } else {
                    throw error;
                }
            }
            return { success: true };
        } catch (error) {
            logger.error(`Error syncing MS Calendar integration ID ${payload.id}:`, error);
            throw error;
        }
    },
});
