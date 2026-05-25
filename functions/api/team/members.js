import { createClient } from '@supabase/supabase-js';

function getAccessToken(request) {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
}

function parseUnitIds(unit_ids) {
    if (!Array.isArray(unit_ids)) return [];
    return [...new Set(unit_ids.filter((id) => id != null))];
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

export async function onRequestPost(context) {
    try {
        const accessToken = getAccessToken(context.request);
        if (!accessToken) {
            return Response.json(
                { success: false, error: 'Missing access token' },
                { status: 401 },
            );
        }

        const { condo_id, email, invite_email, role, unit_ids } = await context.request.json();
        const targetEmail = email || invite_email;
        if (!condo_id || !targetEmail || !role) {
            return Response.json(
                { success: false, error: 'Missing required fields' },
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

        const normalizedEmail = String(targetEmail).trim().toLowerCase();
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, email')
            .ilike('email', normalizedEmail)
            .maybeSingle();

        if (profileError) {
            return Response.json({ success: false, error: profileError.message }, { status: 500 });
        }

        if (!profile?.user_id) {
            return Response.json(
                {
                    success: false,
                    error: 'User not found. Ask this user to create an account first.',
                },
                { status: 400 },
            );
        }

        const { data: existingMember, error: existingMemberError } = await supabase
            .from('condo_members')
            .select('id')
            .eq('condo_id', condo_id)
            .eq('user_id', profile.user_id)
            .maybeSingle();

        if (existingMemberError) {
            return Response.json(
                { success: false, error: existingMemberError.message },
                { status: 500 },
            );
        }

        if (existingMember?.id) {
            return Response.json(
                { success: false, error: 'This user is already a member of this condo' },
                { status: 409 },
            );
        }

        const { data, error } = await supabase
            .from('condo_members')
            .insert([
                {
                    user_id: profile.user_id,
                    role,
                    condo_id,
                    status: 'active',
                },
            ])
            .select('*')
            .single();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        await syncUnitMemberships(supabase, data.id, validUnitIds);

        return Response.json({ success: true, data }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}

export async function onRequestPatch(context) {
    try {
        const accessToken = getAccessToken(context.request);
        if (!accessToken) {
            return Response.json(
                { success: false, error: 'Missing access token' },
                { status: 401 },
            );
        }

        const { condo_id, id, role, unit_ids } = await context.request.json();
        if (!condo_id || !id) {
            return Response.json(
                { success: false, error: 'condo_id and id are required' },
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

        const { data: existing, error: existingError } = await supabase
            .from('condo_members')
            .select('id, role, condo_id')
            .eq('id', id)
            .eq('condo_id', condo_id)
            .maybeSingle();
        if (existingError) {
            return Response.json({ success: false, error: existingError.message }, { status: 500 });
        }
        if (!existing) {
            return Response.json({ success: false, error: 'Member not found' }, { status: 404 });
        }
        if (existing.role === 'owner') {
            return Response.json({ success: false, error: 'Cannot update owner' }, { status: 403 });
        }

        const payload = {};
        if (typeof role === 'string' && role.length > 0) {
            payload.role = role;
        }

        const { data, error } = await supabase
            .from('condo_members')
            .update(payload)
            .eq('id', id)
            .eq('condo_id', condo_id)
            .select('*')
            .single();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        if (Array.isArray(unit_ids)) {
            const normalizedUnitIds = parseUnitIds(unit_ids);
            const validUnitIds = await getValidUnitIdsForCondo(
                supabase,
                condo_id,
                normalizedUnitIds,
            );
            if (normalizedUnitIds.length > 0 && validUnitIds.length !== normalizedUnitIds.length) {
                return Response.json(
                    { success: false, error: 'Some selected units are invalid for this condo' },
                    { status: 400 },
                );
            }
            await syncUnitMemberships(supabase, id, validUnitIds);
        }

        return Response.json({ success: true, data }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}

export async function onRequestDelete(context) {
    try {
        const accessToken = getAccessToken(context.request);
        if (!accessToken) {
            return Response.json(
                { success: false, error: 'Missing access token' },
                { status: 401 },
            );
        }

        const { condo_id, id } = await context.request.json();
        if (!condo_id || !id) {
            return Response.json(
                { success: false, error: 'condo_id and id are required' },
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

        const { data: existing, error: existingError } = await supabase
            .from('condo_members')
            .select('role')
            .eq('id', id)
            .eq('condo_id', condo_id)
            .maybeSingle();
        if (existingError) {
            return Response.json({ success: false, error: existingError.message }, { status: 500 });
        }
        if (!existing) {
            return Response.json({ success: false, error: 'Member not found' }, { status: 404 });
        }
        if (existing.role === 'owner') {
            return Response.json({ success: false, error: 'Cannot delete owner' }, { status: 403 });
        }

        const { error } = await supabase
            .from('condo_members')
            .delete()
            .eq('id', id)
            .eq('condo_id', condo_id);
        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}
