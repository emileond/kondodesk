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

        const { data: integration, error: fetchError } = await supabase
            .from('user_integrations')
            .select('id, scopes, user_id, workspace_id')
            .eq('type', 'microsoft')
            .eq('id', id)
            .single();

        if (fetchError || !integration) {
            return Response.json(
                { success: false, error: 'Integration not found' },
                { status: 404 },
            );
        }

        const serviceScopes = {
            tasks: ['Tasks.ReadWrite'],
            calendar: ['Calendars.ReadWrite', 'Calendars.ReadWrite.Shared'],
        };

        const scopesToRemove = serviceScopes[serviceToDisconnect] || [];
        if (scopesToRemove.length === 0) {
            return Response.json(
                { success: false, error: 'Invalid service specified' },
                { status: 400 },
            );
        }

        const currentScopes = integration.scopes || [];

        // --- START OF FIX ---
        // Instead of an exact match, check if the full scope URL ends with the short name.
        const newScopes = currentScopes.filter(
            (currentScope) =>
                !scopesToRemove.some((scopeToRemove) => currentScope.endsWith(scopeToRemove)),
        );
        // --- END OF FIX ---

        if (serviceToDisconnect === 'tasks') {
            await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'microsoft')
                .eq('user_id', integration.user_id)
                .eq('workspace_id', integration.workspace_id);
        } else if (serviceToDisconnect === 'calendar') {
            await supabase
                .from('events')
                .delete()
                .eq('source', 'microsoft')
                .eq('user_id', integration.user_id)
                .eq('workspace_id', integration.workspace_id);
            await supabase
                .from('calendars')
                .delete()
                .eq('source', 'microsoft')
                .eq('user_id', integration.user_id)
                .eq('workspace_id', integration.workspace_id);
        }

        if (newScopes.length > 0) {
            console.log(
                `Partial disconnect: Removing ${serviceToDisconnect} scopes. Remaining:`,
                newScopes,
            );
            const { error: updateError } = await supabase
                .from('user_integrations')
                .update({ scopes: newScopes })
                .eq('id', id);

            if (updateError)
                return Response.json({ success: false, error: 'Failed to disconnect service' });
        } else {
            console.log('Full disconnect: No scopes remaining. Deleting integration record.');
            // Here you could also revoke the token via Microsoft's API as a final cleanup step.
            const { error: deleteError } = await supabase
                .from('user_integrations')
                .delete()
                .eq('id', id);

            if (deleteError)
                return Response.json({ success: false, error: 'Failed to delete integration' });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error(`Error disconnecting Microsoft service:`, error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
