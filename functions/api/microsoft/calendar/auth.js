import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DB_BATCH_SIZE = 50;

async function refreshAccessToken(context, integration) {
    const newToken = await ky
        .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: context.env.MICROSOFT_CLIENT_ID,
                client_secret: context.env.MICROSOFT_CLIENT_SECRET,
                refresh_token: integration.refresh_token,
                scope: 'Calendars.ReadWrite Calendars.ReadWrite.Shared User.Read offline_access',
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
        .json();

    return newToken;
}

async function fetchAllPages(url, headers) {
    let nextLink = url;
    const allItems = [];
    while (nextLink) {
        const page = await ky.get(nextLink, { headers }).json();
        const items = page.value || [];
        allItems.push(...items);
        nextLink = page['@odata.nextLink'] || null;
    }
    return allItems;
}

// POST -> exchange code and import calendars & events
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { code, user_id, workspace_id } = body;

        if (!code || !user_id || !workspace_id) {
            return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1) Exchange code for token
        const tokenResponse = await ky
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                body: new URLSearchParams({
                    client_id: context.env.MICROSOFT_CLIENT_ID,
                    client_secret: context.env.MICROSOFT_CLIENT_SECRET,
                    code,
                    redirect_uri:
                        'https://weekfuse.com/integrations/oauth/callback/microsoft_calendar',
                    grant_type: 'authorization_code',
                    scope: 'Calendars.ReadWrite Calendars.ReadWrite.Shared User.Read offline_access',
                }),
            })
            .json();

        const { access_token, refresh_token, expires_in, scope } = tokenResponse;
        if (!access_token)
            return Response.json(
                { success: false, error: 'Failed to get access token' },
                { status: 500 },
            );

        const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };

        const grantedScopes = scope ? scope.split(' ') : [];

        // 2) Save integration
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;
        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'microsoft',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: { syncStatus: 'prompt' },
                scopes: grantedScopes,
            })
            .select('id')
            .single();

        if (upsertError) {
            console.error('Error saving integration data:', upsertError);
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        }

        const integration_id = upsertData.id;

        // Save user profile data
        try {
            const userData = await ky.get(`${GRAPH_BASE}/me`, { headers }).json();
            await supabase
                .from('user_integrations')
                .update({ external_data: userData })
                .eq('id', integration_id);
        } catch (e) {
            console.error('Could not fetch Microsoft user data:', e);
        }

        // 3) Fetch calendars
        const cals = await ky.get(`${GRAPH_BASE}/me/calendars`, { headers }).json();

        if (!cals || !Array.isArray(cals.value)) {
            return Response.json(
                { success: false, error: 'Failed to fetch calendars' },
                { status: 500 },
            );
        }

        const calendars = cals.value.filter((cal) => cal.canShare);

        // Upsert calendars
        for (let i = 0; i < calendars.length; i += DB_BATCH_SIZE) {
            const batch = calendars.slice(i, i + DB_BATCH_SIZE);
            const upserts = batch.map((cal) =>
                supabase.from('calendars').upsert(
                    {
                        integration_id,
                        external_id: cal.id,
                        name: cal.name,
                        color: cal.color || null,
                        source: 'microsoft',
                        is_enabled: true,
                        workspace_id,
                        user_id,
                    },
                    { onConflict: 'integration_id, external_id, source, workspace_id, user_id' },
                ),
            );
            await Promise.all(upserts);
        }

        // Build calendarId map (external_id -> id)
        const { data: dbCalendars } = await supabase
            .from('calendars')
            .select('id, external_id')
            .eq('integration_id', integration_id)
            .eq('source', 'microsoft')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id);

        const calendarIdMap = new Map((dbCalendars || []).map((c) => [c.external_id, c.id]));

        // 4) Fetch events for each calendar with pagination and batch upserts
        for (const cal of calendars) {
            try {
                let nextLink = `${GRAPH_BASE}/me/calendars/${cal.id}/events?$top=50`;
                while (nextLink) {
                    const page = await ky.get(nextLink, { headers }).json();
                    const events = page.value || [];

                    for (let i = 0; i < events.length; i += DB_BATCH_SIZE) {
                        const batch = events.slice(i, i + DB_BATCH_SIZE);
                        const upserts = batch.map((ev) => {
                            const isAllDay = !!ev.isAllDay;
                            const start = ev.start?.dateTime ? ev.start.dateTime : null;
                            const end = ev.end?.dateTime ? ev.end.dateTime : null;
                            return supabase.from('events').upsert(
                                {
                                    calendar_id: calendarIdMap.get(cal.id),
                                    external_id: ev.id,
                                    title: ev.subject || null,
                                    description: ev.body?.content || null,
                                    start_time: start,
                                    end_time: end,
                                    is_all_day: isAllDay,
                                    source: 'microsoft',
                                    web_link: ev.webLink || null,
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

                    nextLink = page['@odata.nextLink'] || null;
                }
            } catch (err) {
                console.error(`Failed to import events for calendar ${cal.id}:`, err);
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Microsoft Calendar auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
