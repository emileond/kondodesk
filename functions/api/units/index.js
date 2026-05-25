import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
    try {
        const { condo_id, address, session } = await context.request.json();

        if (!condo_id || !address || !session) {
            return Response.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const { error: authError } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });

        if (authError) {
            return Response.json({ success: false, error: authError.message }, { status: 401 });
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: member, error: memberError } = await supabase
            .from('condo_members')
            .select('role, status')
            .eq('condo_id', condo_id)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

        if (memberError) {
            return Response.json({ success: false, error: memberError.message }, { status: 500 });
        }

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('units')
            .insert([{ condo_id, address, status: 'active' }])
            .select('id, address, status, condo_id')
            .single();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, data }, { status: 200 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
