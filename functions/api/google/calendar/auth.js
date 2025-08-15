import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const DB_BATCH_SIZE = 50;

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { code, user_id, workspace_id } = body;

        if (!code || !user_id || !workspace_id) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required data: code, user_id, or workspace_id',
                }),
                { status: 400 },
            );
        }

        // Initialize the Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // --- Step 1: Exchange authorization code for access and refresh tokens ---
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
                JSON.stringify({ success: false, error: 'Failed to get Google access token' }),
                { status: 500 },
            );
        }

        const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };

        // Save the new integration details to the database
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

        if (upsertError) {
            console.error('Error saving integration data:', upsertError);
            return new Response(
                JSON.stringify({ success: false, error: 'Failed to save integration data' }),
                { status: 500 },
            );
        }

        const integration_id = upsertData.id;

        // Optionally, fetch and save user's Google profile info
        // try {
        //     const userData = await ky
        //         .get('https://www.googleapis.com/oauth2/v2/userinfo', { headers })
        //         .json();
        //     await supabase
        //         .from('user_integrations')
        //         .update({ external_data: userData })
        //         .eq('id', integration_id);
        // } catch (e) {
        //     console.error('Could not fetch Google user data:', e);
        // }

        // --- Step 3: Fetch all calendars from the user's calendar list with pagination ---
        let allCalendars = [];
        let pageToken = null;
        do {
            const params = new URLSearchParams({ maxResults: '250' });
            if (pageToken) {
                params.set('pageToken', pageToken);
            }
            const calPage = await ky
                .get(`${GOOGLE_API_BASE}/users/me/calendarList?${params.toString()}`, { headers })
                .json();

            if (calPage.items && Array.isArray(calPage.items)) {
                // Filter for calendars the user can write to.
                const writeableCals = calPage.items.filter(
                    (cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer',
                );
                allCalendars.push(...writeableCals);
            }
            pageToken = calPage.nextPageToken || null;
        } while (pageToken);

        // --- Step 4: Batch upsert calendars into the database ---
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
            const results = await Promise.all(upserts);
            results.forEach((result, index) => {
                if (result.error) {
                    console.error(
                        `Failed to upsert calendar (external_id: ${batch[index].id}):`,
                        result.error,
                    );
                }
            });
        }

        // Create a map of external_id -> internal_id for efficient event linking
        const { data: dbCalendars } = await supabase
            .from('calendars')
            .select('id, external_id')
            .eq('integration_id', integration_id);

        const calendarIdMap = new Map((dbCalendars || []).map((c) => [c.external_id, c.id]));

        // --- Step 5: For each calendar, fetch and save its events with pagination ---
        for (const cal of allCalendars) {
            const calendar_id = calendarIdMap.get(cal.id);
            if (!calendar_id) continue; // Skip if calendar wasn't saved correctly

            try {
                let eventsPageToken = null;
                do {
                    const params = new URLSearchParams({ maxResults: '2500' });

                    if (eventsPageToken) {
                        params.set('pageToken', eventsPageToken);
                    }

                    // Note: Google Calendar IDs can contain special characters, so they must be encoded.
                    const encodedCalendarId = encodeURIComponent(cal.id);
                    const eventPage = await ky
                        .get(
                            `${GOOGLE_API_BASE}/calendars/${encodedCalendarId}/events?${params.toString()}`,
                            { headers },
                        )
                        .json();

                    const events = eventPage.items || [];

                    // Batch upsert events to the database
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
                        const eventResults = await Promise.all(upserts);
                        eventResults.forEach((result, index) => {
                            if (result.error) {
                                console.error(
                                    `Failed to upsert event (external_id: ${batch[index].id}):`,
                                    result.error,
                                );
                            }
                        });
                    }

                    eventsPageToken = eventPage.nextPageToken || null;
                } while (eventsPageToken);
            } catch (err) {
                console.error(
                    `Failed to import events for calendar ${cal.id}:`,
                    err?.response?.body || err,
                );
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error(
            'Critical error in Google Calendar auth flow:',
            error?.response?.body || error,
        );
        return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
            status: 500,
        });
    }
}
