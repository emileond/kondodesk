import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const condo_id = url.searchParams.get('condo_id');
        if (!condo_id) {
            return Response.json({ success: false, error: 'condo_id is required' }, { status: 400 });
        }

        const authHeader = context.request.headers.get('authorization') || '';
        const accessToken = authHeader.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null;
        if (!accessToken) {
            return Response.json({ success: false, error: 'Missing access token' }, { status: 401 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(accessToken);

        if (userError || !user?.id) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: members, error: membersError } = await supabase
            .from('condo_members')
            .select('id')
            .eq('condo_id', condo_id)
            .eq('user_id', user.id)
            .eq('status', 'active');

        if (membersError) {
            return Response.json({ success: false, error: membersError.message }, { status: 500 });
        }

        const memberIds = (members || []).map((member) => member?.id).filter((id) => id != null);
        if (memberIds.length === 0) {
            return Response.json({ success: true, data: { unit_ids: [] } }, { status: 200 });
        }

        const { data: unitMembers, error: unitMembersError } = await supabase
            .from('unit_members')
            .select('unit_id')
            .in('condo_member_id', memberIds);

        if (unitMembersError) {
            return Response.json({ success: false, error: unitMembersError.message }, { status: 500 });
        }

        const unit_ids = [
            ...new Set((unitMembers || []).map((item) => item?.unit_id).filter(Boolean)),
        ];

        return Response.json({ success: true, data: { unit_ids } }, { status: 200 });
    } catch (err) {
        return Response.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 },
        );
    }
}
