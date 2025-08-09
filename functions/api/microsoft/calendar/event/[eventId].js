import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateExpiresAt } from '../../../../../src/utils/dateUtils.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getAccessToken(context, supabase, workspace_id, user_id) {
    const { data: integration, error } = await supabase
        .from('user_integrations')
        .select('access_token, refresh_token, expires_at')
        .eq('type', 'microsoft_todo')
        .eq('status', 'active')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user_id)
        .single();

    if (error || !integration) {
        return { error: 'Microsoft Calendar integration not found' };
    }

    const currentTime = dayjs().utc();
    const tokenExpired =
        !integration.expires_at || currentTime.isAfter(dayjs(integration.expires_at));
    let accessToken = integration.access_token;

    if (tokenExpired) {
        const newToken = await ky
            .post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: context.env.MICROSOFT_CLIENT_ID,
                    client_secret: context.env.MICROSOFT_CLIENT_SECRET,
                    refresh_token: integration.refresh_token,
                    scope: 'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.Read',
                }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    return { accessToken };
}

export async function onRequestGet(context) {
    try {
        const { eventId } = context.params;
        const url = new URL(context.request.url);
        const workspace_id = url.searchParams.get('workspace_id');
        const user_id = url.searchParams.get('user_id');
        const calendarId = url.searchParams.get('calendarId');

        if (!eventId || !workspace_id || !user_id || !calendarId) {
            return Response.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { accessToken, error } = await getAccessToken(
            context,
            supabase,
            workspace_id,
            user_id,
        );
        if (error) return Response.json({ success: false, error }, { status: 404 });

        const eventDetails = await ky
            .get(`${GRAPH_BASE}/me/calendars/${calendarId}/events/${eventId}`, {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            })
            .json();

        return Response.json({ success: true, event: eventDetails });
    } catch (err) {
        console.error('Error fetching Microsoft Calendar event:', err);
        return Response.json(
            { success: false, error: 'Internal server error', details: err.message },
            { status: 500 },
        );
    }
}

export async function onRequestPatch(context) {
    try {
        const { eventId } = context.params;
        const body = await context.request.json();
        const {
            workspace_id,
            user_id,
            calendarId,
            title,
            description,
            start_time,
            end_time,
            is_all_day,
        } = body;

        if (!eventId || !workspace_id || !user_id || !calendarId) {
            return Response.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { accessToken, error } = await getAccessToken(
            context,
            supabase,
            workspace_id,
            user_id,
        );
        if (error) return Response.json({ success: false, error }, { status: 404 });

        // Build update payload per Microsoft Graph event schema
        const updatePayload = {};
        if (title !== undefined) updatePayload.subject = title;
        if (description !== undefined)
            updatePayload.body = { contentType: 'html', content: description || '' };
        if (start_time !== undefined)
            updatePayload.start = { dateTime: start_time, timeZone: 'UTC' };
        if (end_time !== undefined) updatePayload.end = { dateTime: end_time, timeZone: 'UTC' };
        if (is_all_day !== undefined) updatePayload.isAllDay = !!is_all_day;

        const updatedEvent = await ky
            .patch(`${GRAPH_BASE}/me/calendars/${calendarId}/events/${eventId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                json: updatePayload,
            })
            .json();

        // Update local DB event
        await supabase
            .from('events')
            .update({
                title: updatedEvent.subject || null,
                description: updatedEvent.body?.content || null,
                start_time: updatedEvent.start?.dateTime || null,
                end_time: updatedEvent.end?.dateTime || null,
                is_all_day: !!updatedEvent.isAllDay,
                web_link: updatedEvent.webLink || null,
            })
            .eq('external_id', eventId)
            .eq('source', 'microsoft_calendar')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user_id);

        return Response.json({ success: true, event: updatedEvent });
    } catch (err) {
        console.error('Error updating Microsoft Calendar event:', err);
        return Response.json(
            { success: false, error: 'Internal server error', details: err.message },
            { status: 500 },
        );
    }
}
