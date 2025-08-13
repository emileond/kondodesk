import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';

const DB_BATCH_SIZE = 50;

// POST -> exchange code and import calendars & events
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { code, user_id, workspace_id } = body;

        if (!code || !user_id || !workspace_id) {
            return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const credentials = `${context.env.CALENDLY_CLIENT_ID}:${context.env.CALENDLY_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        // 1) Exchange code for token
        const tokenResponse = await ky
            .post('https://auth.calendly.com/oauth/token', {
                headers: {
                    authorization: `Basic ${encodedCredentials}`,
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/calendly',
                }),
            })
            .json();

        const { access_token, refresh_token, expires_in } = tokenResponse;
        if (!access_token)
            return Response.json(
                { success: false, error: 'Failed to get access token' },
                { status: 500 },
            );

        const headers = {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        };

        // 2) Save integration
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;

        const { data: upsertData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'calendly',
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
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        }

        const integration_id = upsertData.id;

        // Save user profile data
        let userData;
        try {
            userData = await ky.get('https://api.calendly.com/users/me', { headers }).json();
            await supabase
                .from('user_integrations')
                .update({ external_data: userData.resource })
                .eq('id', integration_id);
        } catch (e) {
            console.error('Could not fetch Calendly user data:', e);
            return Response.json(
                { success: false, error: 'Failed to fetch Calendly user data' },
                { status: 500 },
            );
        }

        // Upsert

        const { data: calData, error: calError } = await supabase
            .from('calendars')
            .upsert(
                {
                    integration_id,
                    name: userData.resource.slug,
                    external_id: userData.resource.uri,
                    color: null,
                    source: 'calendly',
                    is_enabled: true,
                    workspace_id,
                    user_id,
                },
                { onConflict: 'integration_id, external_id, source, workspace_id, user_id' },
            )
            .select('id')
            .single();

        if (calError) {
            console.error('Error saving calendar data:', calError);
            return Response.json(
                { success: false, error: 'Failed to save calendar data' },
                { status: 500 },
            );
        }

        // 4) Fetch events with pagination and batch upserts
        try {
            let nextLink = `https://api.calendly.com/scheduled_events?user=${userData.resource.uri}&status=active&count=50`;
            while (nextLink) {
                const page = await ky.get(nextLink, { headers }).json();
                const events = page.collection || [];

                for (let i = 0; i < events.length; i += DB_BATCH_SIZE) {
                    const batch = events.slice(i, i + DB_BATCH_SIZE);
                    const upserts = batch.map((ev) => {
                        return supabase.from('events').upsert(
                            {
                                calendar_id: calData.id,
                                external_id: ev.uri,
                                title: ev.name || null,
                                description: ev?.meeting_notes_html || null,
                                start_time: ev?.start_time,
                                end_time: ev?.end_time,
                                source: 'calendly',
                                web_link: 'https://calendly.com/app/scheduled_events/user/me',
                                location_label: ev.location?.location || ev.location?.join_url,
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

                nextLink = page?.pagination?.next_page || null;
            }
        } catch (err) {
            console.error(`Failed to import calendly events:`, err);
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Calendly auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
