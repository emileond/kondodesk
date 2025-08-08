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
        const newScopes = currentScopes.filter(
            (currentScope) =>
                !scopesToRemove.some((scopeToRemove) => currentScope.endsWith(scopeToRemove)),
        );

        // Clean up data for the disconnected service
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

        // --- START OF FIX ---
        // Define all possible service scopes your app uses.
        const allServiceScopes = [
            'Tasks.ReadWrite',
            'Calendars.ReadWrite',
            'Calendars.ReadWrite.Shared',
        ];

        // Check if any of the remaining scopes are actual service scopes.
        const hasRemainingServiceScopes = newScopes.some((remainingScope) =>
            allServiceScopes.some((serviceScope) => remainingScope.endsWith(serviceScope)),
        );
        // --- END OF FIX ---

        // Decide whether to UPDATE the record or DELETE it based on the new check.
        if (hasRemainingServiceScopes) {
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
            console.log(
                'Full disconnect: No service scopes remaining. Deleting integration record.',
            );
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
