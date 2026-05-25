import { createClient } from '@supabase/supabase-js';

function parseUnitIds(unit_ids) {
    if (!Array.isArray(unit_ids)) return [];
    return [...new Set(unit_ids.filter((id) => id != null))];
}

async function syncUnitMemberships(supabase, condoMemberId, unitIds) {
    const { error: deleteError } = await supabase
        .from('unit_members')
        .delete()
        .eq('condo_member_id', condoMemberId);
    if (deleteError) throw new Error(deleteError.message);

    if (!Array.isArray(unitIds) || unitIds.length === 0) return;

    const rows = unitIds.map((unit_id) => ({
        condo_member_id: condoMemberId,
        unit_id,
    }));
    const { error: insertError } = await supabase.from('unit_members').insert(rows);
    if (insertError) throw new Error(insertError.message);
}

function sanitizeInvitation(invite) {
    if (!invite) return null;
    return {
        email: invite.email,
        role: invite.role,
        condo_id: invite.condo_id,
        status: invite.status,
        expires_at: invite.expires_at,
    };
}

export async function onRequestGet(context) {
    try {
        const token = new URL(context.request.url).searchParams.get('invitation_token');
        if (!token) {
            return Response.json({ success: false, error: 'invitation_token is required' }, { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { data: invite, error } = await supabase
            .from('condo_invitations')
            .select('email, role, condo_id, status, expires_at, condos:condo_id(name)')
            .eq('token', token)
            .maybeSingle();

        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        if (!invite) return Response.json({ success: false, error: 'Invitation not found' }, { status: 404 });

        if (invite.status !== 'pending') {
            return Response.json({ success: false, error: 'Invitation is no longer pending' }, { status: 400 });
        }
        if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
            return Response.json({ success: false, error: 'Invitation has expired' }, { status: 400 });
        }

        return Response.json(
            {
                success: true,
                data: {
                    ...sanitizeInvitation(invite),
                    condo_name: invite?.condos?.name || null,
                },
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

export async function onRequestPost(context) {
    try {
        const { invitation_token, password } = await context.request.json();
        if (!invitation_token || !password) {
            return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        if (String(password).length < 8) {
            return Response.json(
                { success: false, error: 'Password must be at least 8 characters' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { data: invite, error: inviteError } = await supabase
            .from('condo_invitations')
            .select('*')
            .eq('token', invitation_token)
            .maybeSingle();
        if (inviteError) return Response.json({ success: false, error: inviteError.message }, { status: 500 });
        if (!invite) return Response.json({ success: false, error: 'Invitation not found' }, { status: 404 });
        if (invite.status !== 'pending') {
            return Response.json({ success: false, error: 'Invitation is no longer pending' }, { status: 400 });
        }
        if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
            return Response.json({ success: false, error: 'Invitation has expired' }, { status: 400 });
        }

        const email = String(invite.email || '').trim().toLowerCase();
        if (!email) {
            return Response.json({ success: false, error: 'Invalid invitation email' }, { status: 400 });
        }

        // Resolve/create auth user
        let userId = null;
        const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('user_id')
            .ilike('email', email)
            .maybeSingle();
        if (profileByEmail?.user_id) {
            userId = profileByEmail.user_id;
            const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
                password,
            });
            if (updateUserError) {
                return Response.json({ success: false, error: updateUserError.message }, { status: 500 });
            }
        } else {
            const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });
            if (createUserError || !createdUser?.user?.id) {
                return Response.json(
                    { success: false, error: createUserError?.message || 'Failed to create user' },
                    { status: 500 },
                );
            }
            userId = createdUser.user.id;
        }

        // Membership
        const { data: existingMember, error: existingMemberError } = await supabase
            .from('condo_members')
            .select('id')
            .eq('condo_id', invite.condo_id)
            .eq('user_id', userId)
            .maybeSingle();
        if (existingMemberError) {
            return Response.json({ success: false, error: existingMemberError.message }, { status: 500 });
        }

        let condoMemberId = existingMember?.id;
        if (!condoMemberId) {
            const { data: createdMember, error: createMemberError } = await supabase
                .from('condo_members')
                .insert([
                    {
                        condo_id: invite.condo_id,
                        user_id: userId,
                        role: invite.role,
                        status: 'active',
                    },
                ])
                .select('id')
                .single();
            if (createMemberError) {
                return Response.json({ success: false, error: createMemberError.message }, { status: 500 });
            }
            condoMemberId = createdMember.id;
        } else {
            const { error: updateMemberError } = await supabase
                .from('condo_members')
                .update({
                    role: invite.role,
                    status: 'active',
                })
                .eq('id', condoMemberId);
            if (updateMemberError) {
                return Response.json({ success: false, error: updateMemberError.message }, { status: 500 });
            }
        }

        await syncUnitMemberships(supabase, condoMemberId, parseUnitIds(invite.unit_ids));

        const { error: markInviteError } = await supabase
            .from('condo_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
                accepted_user_id: userId,
            })
            .eq('id', invite.id);
        if (markInviteError) {
            return Response.json({ success: false, error: markInviteError.message }, { status: 500 });
        }

        return Response.json({ success: true, data: { email } }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}

