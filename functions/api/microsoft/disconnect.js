import { createClient } from '@supabase/supabase-js';

export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id, serviceToDisconnect } = body;

        if (!id || !serviceToDisconnect) {
            return Response.json(
                { success: false, error: 'Missing id or service' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        if (serviceToDisconnect === 'todo') {
            const { error } = await supabase
                .from('user_integrations')
                .delete()
                .eq('type', 'microsoft_todo')
                .eq('id', id);

            if (error) {
                console.error(error);
                return Response.json(
                    { success: false, error: 'Error deleting token' },
                    { status: 500 },
                );
            }
        } else if (serviceToDisconnect === 'calendar') {
            const { error } = await supabase
                .from('user_integrations')
                .delete()
                .eq('type', 'microsoft_calendar')
                .eq('id', id);

            console.error(error);
            return Response.json(
                { success: false, error: 'Error deleting token' },
                { status: 500 },
            );
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error(`Error disconnecting Microsoft service:`, error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
