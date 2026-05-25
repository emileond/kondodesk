import { createClient } from '@supabase/supabase-js';
import {
    buildTeamInvitationEmailHtml,
    teamInvitationSubject,
    teamInvitationText,
} from './emailTemplate';

function getAccessToken(request) {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
}

function parseUnitIds(unit_ids) {
    if (!Array.isArray(unit_ids)) return [];
    return [...new Set(unit_ids.filter((id) => id != null))];
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function authorizeAdmin(supabase, condoId, accessToken) {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user?.id) {
        return { error: 'Unauthorized', status: 401 };
    }

    const { data: actor, error: actorError } = await supabase
        .from('condo_members')
        .select('role, status')
        .eq('condo_id', condoId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

    if (actorError) return { error: actorError.message, status: 500 };
    if (!actor || !['owner', 'admin'].includes(actor.role)) {
        return { error: 'Forbidden', status: 403 };
    }

    return { user };
}

async function getValidUnitIdsForCondo(supabase, condoId, unitIds) {
    if (!Array.isArray(unitIds) || unitIds.length === 0) return [];
    const { data, error } = await supabase
        .from('units')
        .select('id')
        .eq('condo_id', condoId)
        .in('id', unitIds);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => row.id);
}

async function sendInvitationEmail({ env, email, invitationLink, inviterName, condoName }) {
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_EMAIL_API_TOKEN || env.CF_API_TOKEN;
    if (!accountId || !apiToken) {
        throw new Error('Cloudflare Email API env vars are missing: CF_ACCOUNT_ID / CF_API_TOKEN');
    }

    const fromAddress = env.EMAIL_FROM || 'reservas@kondodesk.com';
    const textBody = teamInvitationText({ inviterName, condoName, invitationLink });
    const htmlBody = buildTeamInvitationEmailHtml({
        appUrl: env.VITE_PUBLIC_URL || 'https://kondodesk.com',
        inviterName,
        condoName,
        invitationLink,
    });

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: email,
                from: fromAddress,
                subject: teamInvitationSubject({ condoName }),
                html: htmlBody,
                text: textBody,
            }),
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare Email API failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    if (!payload?.success) {
        throw new Error(
            `Cloudflare Email API error: ${payload?.errors?.[0]?.message || 'Unknown error'}`,
        );
    }
}

export async function onRequestPost(context) {
    try {
        const accessToken = getAccessToken(context.request);
        if (!accessToken) {
            return Response.json(
                { success: false, error: 'Missing access token' },
                { status: 401 },
            );
        }

        const { condo_id, email, role, unit_ids } = await context.request.json();
        if (!condo_id || !email || !role) {
            return Response.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 },
            );
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            return Response.json(
                { success: false, error: 'Invalid email address' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const authResult = await authorizeAdmin(supabase, condo_id, accessToken);
        if (authResult.error) {
            return Response.json(
                { success: false, error: authResult.error },
                { status: authResult.status },
            );
        }

        const normalizedUnitIds = parseUnitIds(unit_ids);
        const validUnitIds = await getValidUnitIdsForCondo(supabase, condo_id, normalizedUnitIds);
        if (normalizedUnitIds.length > 0 && validUnitIds.length !== normalizedUnitIds.length) {
            return Response.json(
                { success: false, error: 'Some selected units are invalid for this condo' },
                { status: 400 },
            );
        }

        const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('user_id')
            .ilike('email', normalizedEmail)
            .maybeSingle();

        if (profileByEmail?.user_id) {
            const { data: existingMember, error: existingMemberError } = await supabase
                .from('condo_members')
                .select('id')
                .eq('condo_id', condo_id)
                .eq('user_id', profileByEmail.user_id)
                .in('status', ['active', 'pending'])
                .maybeSingle();

            if (existingMemberError) {
                return Response.json(
                    { success: false, error: existingMemberError.message },
                    { status: 500 },
                );
            }

            if (existingMember?.id) {
                return Response.json(
                    { success: false, error: 'This user is already a condo member' },
                    { status: 409 },
                );
            }
        }

        const { data: condo, error: condoError } = await supabase
            .from('condos')
            .select('name')
            .eq('id', condo_id)
            .maybeSingle();
        if (condoError) {
            return Response.json({ success: false, error: condoError.message }, { status: 500 });
        }

        const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('user_id', authResult.user.id)
            .maybeSingle();
        const inviterName =
            inviterProfile?.name || inviterProfile?.email || authResult.user.email || 'Admin';

        const { data: existingPendingInvite, error: existingInviteError } = await supabase
            .from('condo_invitations')
            .select('*')
            .eq('condo_id', condo_id)
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingInviteError) {
            return Response.json(
                { success: false, error: existingInviteError.message },
                { status: 500 },
            );
        }

        let inviteRecord = existingPendingInvite;
        if (inviteRecord) {
            const { data: updatedInvite, error: updateInviteError } = await supabase
                .from('condo_invitations')
                .update({
                    role,
                    unit_ids: validUnitIds,
                    invited_by_user_id: authResult.user.id,
                    invited_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                })
                .eq('id', inviteRecord.id)
                .select('*')
                .single();
            if (updateInviteError) {
                return Response.json(
                    { success: false, error: updateInviteError.message },
                    { status: 500 },
                );
            }
            inviteRecord = updatedInvite;
        } else {
            const token = crypto.randomUUID();
            const { data: createdInvite, error: createInviteError } = await supabase
                .from('condo_invitations')
                .insert([
                    {
                        condo_id,
                        email: normalizedEmail,
                        role,
                        unit_ids: validUnitIds,
                        token,
                        status: 'pending',
                        invited_by_user_id: authResult.user.id,
                        invited_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                    },
                ])
                .select('*')
                .single();
            if (createInviteError) {
                return Response.json(
                    { success: false, error: createInviteError.message },
                    { status: 500 },
                );
            }
            inviteRecord = createdInvite;
        }

        const baseUrl = context.env.VITE_PUBLIC_URL || new URL(context.request.url).origin;
        const invitationLink = `${baseUrl}/accept-invite?invitation_token=${encodeURIComponent(inviteRecord.token)}`;
        let emailDelivery = { sent: true, error: null };
        try {
            await sendInvitationEmail({
                env: context.env,
                email: normalizedEmail,
                invitationLink,
                inviterName,
                condoName: condo?.name || 'tu condominio',
            });
        } catch (emailError) {
            emailDelivery = {
                sent: false,
                error: emailError?.message || 'Failed to send invitation email',
            };
            console.error('Invitation email delivery failed:', emailDelivery.error);
        }

        return Response.json(
            {
                success: true,
                data: inviteRecord,
                invitation_link: invitationLink,
                email_delivery: emailDelivery,
            },
            { status: 200 },
        );
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}

export async function onRequestGet(context) {
    try {
        const accessToken = getAccessToken(context.request);
        if (!accessToken) {
            return Response.json({ success: false, error: 'Missing access token' }, { status: 401 });
        }

        const url = new URL(context.request.url);
        const condo_id = url.searchParams.get('condo_id');
        if (!condo_id) {
            return Response.json({ success: false, error: 'condo_id is required' }, { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const authResult = await authorizeAdmin(supabase, condo_id, accessToken);
        if (authResult.error) {
            return Response.json({ success: false, error: authResult.error }, { status: authResult.status });
        }

        const { data, error } = await supabase
            .from('condo_invitations')
            .select('id, email, role, unit_ids, status, invited_at, expires_at')
            .eq('condo_id', condo_id)
            .eq('status', 'pending')
            .order('invited_at', { ascending: false });

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, data: data || [] }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}
