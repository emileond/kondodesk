import { createClient } from '@supabase/supabase-js';

export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        // 1. Client now sends which service to disconnect
        const { id, serviceToDisconnect } = body;

        if (!id || !serviceToDisconnect) {
            return Response.json(
                { success: false, error: 'Missing id or service' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 2. Fetch the full integration record, including scopes
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

        // 3. Define which scopes belong to which service
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

        // 4. Filter the current scopes to get the new, smaller set
        const currentScopes = integration.scopes || [];
        const newScopes = currentScopes.filter((scope) => !scopesToRemove.includes(scope));

        // 5. Clean up data for the disconnected service
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
            // Also delete the calendars themselves
            await supabase
                .from('calendars')
                .delete()
                .eq('source', 'microsoft')
                .eq('user_id', integration.user_id)
                .eq('workspace_id', integration.workspace_id);
        }

        // 6. Decide whether to UPDATE the record or DELETE it
        if (newScopes.length > 0) {
            // --- Other services are still connected: UPDATE the scopes ---
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
            // --- This was the last service: DELETE the integration record ---
            console.log('Full disconnect: No scopes remaining. Deleting integration record.');
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
