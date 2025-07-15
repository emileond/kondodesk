import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
    try {
        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Parse the webhook payload
        const payload = await context.request.json();

        // Asana webhook verification - respond to handshake
        if (payload.events && payload.events.length === 0) {
            // This is a webhook verification request
            const headers = context.request.headers;
            const hookSecret = headers.get('x-hook-secret');
            
            if (hookSecret) {
                return new Response(null, {
                    status: 200,
                    headers: {
                        'X-Hook-Secret': hookSecret
                    }
                });
            }
        }

        // Process webhook events
        const events = payload.events || [];
        
        for (const event of events) {
            try {
                // Only process task events
                if (event.resource && event.resource.resource_type === 'task') {
                    await processTaskEvent(supabase, event, context.env);
                }
            } catch (eventError) {
                console.error(`Error processing event ${event.resource?.gid}:`, eventError);
                // Continue processing other events even if one fails
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error processing Asana webhook:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

async function processTaskEvent(supabase, event, env) {
    const taskGid = event.resource.gid;
    const action = event.action;

    // Find the integration that should handle this task
    // We need to get the task details first to find the assignee
    let taskDetails;
    let integration;

    try {
        // We need to find an active Asana integration to fetch task details
        const { data: integrations, error: integrationsError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('type', 'asana')
            .eq('status', 'active');

        if (integrationsError || !integrations || integrations.length === 0) {
            console.error('No active Asana integrations found');
            return;
        }

        // Try to fetch task details with each integration until we find one that works
        for (const int of integrations) {
            try {
                const response = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url,assignee.gid`, {
                    headers: {
                        'Authorization': `Bearer ${int.access_token}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const taskResponse = await response.json();
                    taskDetails = taskResponse.data;
                    
                    // Check if this task is assigned to the user of this integration
                    if (taskDetails.assignee && taskDetails.assignee.gid === int.external_data?.gid) {
                        integration = int;
                        break;
                    }
                }
            } catch (fetchError) {
                console.error(`Error fetching task with integration ${int.id}:`, fetchError);
                continue;
            }
        }

        if (!integration || !taskDetails) {
            console.log(`Task ${taskGid} not assigned to any integrated user or not accessible`);
            return;
        }

    } catch (error) {
        console.error(`Error finding integration for task ${taskGid}:`, error);
        return;
    }

    // Get project_id from integration config if available
    const project_id = integration.config?.project_id || null;

    if (action === 'added') {
        // Task was created - insert new task
        const { error: insertError } = await supabase.from('tasks').insert({
            name: taskDetails.name,
            description: taskDetails.notes || null,
            workspace_id: integration.workspace_id,
            integration_source: 'asana',
            external_id: taskDetails.gid,
            external_data: taskDetails,
            host: 'https://app.asana.com',
            assignee: integration.user_id,
            creator: integration.user_id,
            project_id: project_id,
        });

        if (insertError) {
            console.error(`Insert error for task ${taskGid}:`, insertError);
            return;
        }

        console.log(`Task ${taskGid} created successfully`);
    } else if (action === 'changed') {
        // Task was updated - update existing task
        const { data: updateData, error: updateError } = await supabase
            .from('tasks')
            .update({
                name: taskDetails.name,
                description: taskDetails.notes || null,
                external_data: taskDetails,
                project_id: project_id,
            })
            .eq('integration_source', 'asana')
            .eq('external_id', taskDetails.gid)
            .eq('host', 'https://app.asana.com')
            .eq('workspace_id', integration.workspace_id)
            .select();

        if (updateError) {
            console.error(`Update error for task ${taskGid}:`, updateError);
            return;
        }

        if (updateData && updateData.length > 0) {
            console.log(`Task ${taskGid} updated successfully`);
        } else {
            console.log(`Task ${taskGid} not found in database, might have been deleted or not imported yet`);
        }
    } else if (action === 'removed') {
        // Task was deleted - remove from database
        const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'asana')
            .eq('external_id', taskDetails.gid)
            .eq('host', 'https://app.asana.com')
            .eq('workspace_id', integration.workspace_id);

        if (deleteError) {
            console.error(`Delete error for task ${taskGid}:`, deleteError);
            return;
        }

        console.log(`Task ${taskGid} deleted successfully`);
    }
}