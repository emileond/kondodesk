import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const DB_BATCH_SIZE = 50;

async function syncEventsInBackground(
    context,
    { headers, integration_id, allCalendars, calendarIdMap, user_id, workspace_id },
) {
    console.log(`Starting background event sync for integration_id: ${integration_id}`);
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

    // Fetch events from one month in the past to one year in the future.
    const timeMin = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();
    const timeMax = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

    for (const cal of allCalendars) {
        const calendar_id = calendarIdMap.get(cal.id);
        if (!calendar_id) continue;

        try {
            let eventsPageToken = null;
            do {
                const params = new URLSearchParams({
                    maxResults: '2500',
                    timeMin: timeMin,
                    timeMax: timeMax,
                    singleEvents: 'true',
                    orderBy: 'startTime',
                });

                if (eventsPageToken) {
                    params.set('pageToken', eventsPageToken);
                }

                const encodedCalendarId = encodeURIComponent(cal.id);
                const eventPage = await ky
                    .get(
                        `${GOOGLE_API_BASE}/calendars/${encodedCalendarId}/events?${params.toString()}`,
                        { headers },
                    )
                    .json();
                const events = eventPage.items || [];

                for (let i = 0; i < events.length; i += DB_BATCH_SIZE) {
                    const batch = events.slice(i, i + DB_BATCH_SIZE);
                    const upserts = batch.map((ev) => {
                        const isAllDay = !!ev.start.date;
                        let meetingUrl = ev.hangoutLink || null;
                        if (ev.conferenceData && ev.conferenceData.entryPoints) {
                            const videoEntryPoint = ev.conferenceData.entryPoints.find(
                                (ep) => ep.entryPointType === 'video',
                            );
                            if (videoEntryPoint && videoEntryPoint.uri) {
                                meetingUrl = videoEntryPoint.uri;
                            }
                        }
                        // Note: We return the promise here, not awaiting it yet.
                        return supabase.from('events').upsert(
                            {
                                calendar_id,
                                external_id: ev.id,
                                title: ev.summary || null,
                                description: ev.description || null,
                                start_time: isAllDay ? ev.start.date : ev.start.dateTime,
                                end_time: isAllDay ? ev.end.date : ev.end.dateTime,
                                is_all_day: isAllDay,
                                source: 'google_calendar',
                                web_link: ev.htmlLink || null,
                                meeting_url: meetingUrl,
                                location_label: ev.location || null,
                                workspace_id,
                                user_id,
                            },
                            {
                                onConflict:
                                    'calendar_id, external_id, source, workspace_id, user_id',
                            },
                        );
                    });

                    await Promise.all(upserts);
                }
                eventsPageToken = eventPage.nextPageToken || null;
            } while (eventsPageToken);
        } catch (err) {
            console.error(
                `Background sync failed for calendar ${cal.id}:`,
                err?.response?.body || err,
            );

            console.error(`Background sync failed for calendar ${cal.id}:`, errorDetails);
        }
    }
    console.log(`Finished background event sync for integration_id: ${integration_id}`);
}

/**
 * Main Cloudflare Pages Function to handle the POST request for Google Calendar OAuth callback.
 * It performs the initial, quick steps of the integration and then hands off the
 * long-running event import to a background process using `waitUntil`.
 */
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { code, user_id, workspace_id } = body;

        if (!code || !user_id || !workspace_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required data' }),
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // --- Step 1: Exchange code for tokens (Quick) ---
        const tokenResponse = await ky
            .post('https://oauth2.googleapis.com/token', {
                json: {
                    client_id: context.env.GOOGLE_OAUTH_CLIENT_ID,
                    client_secret: context.env.GOOGLE_OAUTH_CLIENT_SECRET,
                    code,
                    redirect_uri:
                        'https://weekfuse.com/integrations/oauth/callback/google_calendar',
                    grant_type: 'authorization_code',
                },
            })
            .json();

        const { access_token, refresh_token, expires_in } = tokenResponse;
        if (!access_token) {
            console.error('Google token exchange failed:', tokenResponse);
            return new Response(
                JSON.stringify({ success: false, error: 'Token exchange failed' }),
                { status: 500 },
            );
        }

        const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };

        // --- Step 2: Save integration details (Quick) ---
        const expires_at = expires_in ? calculateExpiresAt(expires_in) : null;
        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'google_calendar',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: { syncStatus: 'prompt' },
            })
            .select('id')
            .single();

        if (upsertError) throw upsertError;
        const integration_id = upsertData.id;

        // --- Step 3: Fetch and save calendars (Relatively Quick) ---
        let allCalendars = [];
        let pageToken = null;
        do {
            const params = new URLSearchParams({ maxResults: '250' });
            if (pageToken) params.set('pageToken', pageToken);
            const calPage = await ky
                .get(`${GOOGLE_API_BASE}/users/me/calendarList?${params.toString()}`, { headers })
                .json();
            if (calPage.items) {
                const writeableCals = calPage.items.filter(
                    (cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer',
                );
                allCalendars.push(...writeableCals);
            }
            pageToken = calPage.nextPageToken || null;
        } while (pageToken);

        for (let i = 0; i < allCalendars.length; i += DB_BATCH_SIZE) {
            const batch = allCalendars.slice(i, i + DB_BATCH_SIZE);
            const upserts = batch.map((cal) =>
                supabase.from('calendars').upsert(
                    {
                        integration_id,
                        external_id: cal.id,
                        name: cal.summary,
                        color: cal.backgroundColor || null,
                        source: 'google_calendar',
                        is_enabled: true,
                        workspace_id,
                        user_id,
                    },
                    { onConflict: 'integration_id, external_id, source, workspace_id, user_id' },
                ),
            );
            await Promise.all(upserts);
        }

        const { data: dbCalendars } = await supabase
            .from('calendars')
            .select('id, external_id')
            .eq('integration_id', integration_id);
        const calendarIdMap = new Map((dbCalendars || []).map((c) => [c.external_id, c.id]));

        // --- Step 4: Start background sync and return response immediately ---
        const backgroundSyncPromise = syncEventsInBackground(context, {
            headers,
            integration_id,
            allCalendars,
            calendarIdMap,
            user_id,
            workspace_id,
        });

        context.waitUntil(backgroundSyncPromise);

        return new Response(
            JSON.stringify({ success: true, message: 'Sync started in background.' }),
            { status: 200 },
        );
    } catch (error) {
        console.error('Critical error in Google Calendar auth flow:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
            status: 500,
        });
    }
}
