import { createClient } from '@supabase/supabase-js';
import { buildAnnouncementEmailHtml, buildAnnouncementEmailText } from './emailTemplate';

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function sendEmail(env, { to, subject, text, html }) {
    if (!isValidEmail(to)) return;

    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_EMAIL_API_TOKEN || env.CF_API_TOKEN;
    if (!accountId || !apiToken) {
        throw new Error('Cloudflare Email API env vars missing: CF_ACCOUNT_ID / CF_API_TOKEN');
    }

    const fromAddress = env.EMAIL_FROM || 'reservas@kondodesk.com';
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                from: fromAddress,
                subject,
                html: html || '',
                text: text || '',
            }),
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare Email API failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    if (!payload?.success) {
        throw new Error(payload?.errors?.[0]?.message || 'Cloudflare Email API error');
    }
}

export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const { condo_id, title, content } = await request.json();

        if (!condo_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'condo_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        const { data: members, error: membersError } = await supabase
            .from('condo_members')
            .select('user_id, invite_email')
            .eq('condo_id', condo_id);

        if (membersError) {
            throw new Error(membersError.message);
        }

        const userIds = (members || []).map((m) => m.user_id).filter(Boolean);
        let profilesByUserId = new Map();

        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('user_id, email')
                .in('user_id', userIds);

            if (profilesError) {
                throw new Error(profilesError.message);
            }
            profilesByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
        }

        const recipients = new Set();
        for (const member of members || []) {
            const profileEmail = member.user_id
                ? String(profilesByUserId.get(member.user_id)?.email || '').trim()
                : '';
            const inviteEmail = String(member.invite_email || '').trim();

            if (isValidEmail(profileEmail)) recipients.add(profileEmail.toLowerCase());
            else if (isValidEmail(inviteEmail)) recipients.add(inviteEmail.toLowerCase());
        }

        const appUrl = env.VITE_PUBLIC_URL || 'https://kondodesk.com';
        const subject = `Nuevo aviso: ${title || 'Aviso'}`;
        const text = buildAnnouncementEmailText({ title, content, appUrl });
        const html = buildAnnouncementEmailHtml({ title, content, appUrl });

        let sent = 0;
        let failed = 0;

        for (const email of recipients) {
            try {
                await sendEmail(env, { to: email, subject, text, html });
                sent += 1;
            } catch (error) {
                console.error(`Failed sending announcement email to ${email}:`, error);
                failed += 1;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                sent,
                failed,
                total: recipients.size,
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ success: false, error: 'Failed to notify residents', message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
