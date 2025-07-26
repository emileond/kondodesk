import ky from 'ky';
import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
    // 1. Authenticate the request using the API key from headers
    const apiKey = context.request.headers.get('x-api-key');
    if (!apiKey || apiKey !== context.env.WEBHOOK_API_KEY) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

    // 2. Parse the incoming JSON payload from the request body
    const body = await context.request.json();
    const { type, table, record, old_record } = body;

    // 3. Validate that the essential parts of the payload are present
    if (!type || !table || !record) {
        return Response.json({ error: 'Missing required webhook parameters' }, { status: 400 });
    }

    // 4. Filter for the specific event we care about.
    // We only want to act when a 'workspaces' record is updated to 'trial_ended'.
    // For all other events, we return a 200 OK to prevent the webhook service from retrying.
    if (
        type !== 'UPDATE' ||
        table !== 'workspaces' ||
        record.subscription_status !== 'trial ended'
    ) {
        return Response.json(
            { message: 'Event does not apply. No action taken.' },
            { status: 200 },
        );
    }

    // 5. (Optional but Recommended) Check if the status was already 'trial_ended' to prevent sending duplicate emails.
    if (old_record && old_record.subscription_status === 'trial ended') {
        return Response.json(
            { message: 'Status was already trial_ended. No action taken.' },
            { status: 200 },
        );
    }

    // 6. Extract the user id to fetch their email
    const userId = record.user_id;

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', userId)
        .single();

    if (profileError) {
        console.error('Error fetching profile for user_id:', userId, profileError);
        return Response.json({ error: 'Error fetching email from profile table' }, { status: 400 });
    }

    const email = profile?.email;

    if (!email) {
        console.error('Profile or email not found for user_id:', userId);
        return Response.json(
            { error: 'Invalid or missing email in workspace record' },
            { status: 400 },
        );
    }

    // 7. Send the transactional email using the Listmonk API
    try {
        const sendEmailUrl = `${context.env.LISTMONK_URL}/api/tx`;

        const response = await ky.post(sendEmailUrl, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `token ${context.env.LISTMONK_USERNAME}:${context.env.LISTMONK_ACCESS_TOKEN}`,
            },
            json: {
                subscriber_email: email,
                template_id: 8,
                content_type: 'html',
            },
            timeout: 10000,
        });

        const data = await response.json();
        console.log(`Successfully dispatched 'Trial Ended' email to ${email}`);
        return Response.json({ message: 'Email sent successfully', data }, { status: 200 });
    } catch (error) {
        console.error(`Failed to send email to ${email} via Listmonk.`);
        if (error.response) {
            const errorBody = await error.response.text();
            console.error('Listmonk API responded with status:', error.response.status);
            console.error('Listmonk API response body:', errorBody);
            return Response.json(
                {
                    error: 'Failed to send email',
                    details: errorBody,
                },
                { status: error.response.status },
            );
        } else {
            // Handle network errors or other exceptions
            console.error('Network error or other issue:', error.message);
            return Response.json(
                { error: 'Internal Server Error', details: error.message },
                { status: 500 },
            );
        }
    }
}
