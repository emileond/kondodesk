import { createClient } from '@supabase/supabase-js';
import Zavu from '@zavudev/sdk';
import { buildAnnouncementEmailHtml, buildAnnouncementEmailText } from './emailTemplate';

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function sendEmail(env, { to, subject, text, html }) {
    if (!isValidEmail(to)) return;

    const apiKey = env.ZEVU_API_KEY;
    if (!apiKey) {
        throw new Error('Zavu email API env var is missing: ZEVU_API_KEY');
    }

    const zavu = new Zavu({ apiKey });
    await zavu.messages.send({
        to,
        channel: 'email',
        subject,
        text: text || '',
        htmlBody: html || '',
    });
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
