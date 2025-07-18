import { createClient } from '@supabase/supabase-js';
import ky from 'ky';

export async function onRequestPost(context) {
    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // First, check for the Asana handshake request
        const hookSecret = context.request.headers.get('x-hook-secret');
        if (hookSecret) {
            console.log('Received Asana webhook handshake.');
            return new Response(null, {
                status: 200,
                headers: { 'X-Hook-Secret': hookSecret },
            });
        }

        // 1. Get the unique integration_id from the URL query parameter
        const url = new URL(context.request.url);
        const integration_id = url.searchParams.get('integration_id');

        if (!integration_id) {
            console.error('Webhook received without an integration_id.');
            return Response.json(
                { success: false, error: 'Missing integration identifier' },
                { status: 400 },
            );
        }

        // 2. Fetch the specific integration record using the ID
        const { data: integration, error: integrationError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('id', integration_id)
            .single();

        if (integrationError || !integration) {
            console.error(
                `Webhook for unknown or inactive integration_id: ${integration_id}`,
                integrationError,
            );
            // Return 200 so Asana doesn't retry. The integration is gone from our end.
            return Response.json({
                success: true,
                message: 'Integration not found, event ignored.',
            });
        }

        // 3. Process the events in the payload
        const payload = await context.request.json();
        const events = payload.events || [];

        // Use Promise.allSettled to process events concurrently without stopping if one fails
        const eventPromises = events.map((event) => {
            if (event.resource?.resource_type === 'task') {
                return processTaskEvent(supabase, event, integration);
            }
            return Promise.resolve(); // Resolve non-task events immediately
        });

        await Promise.allSettled(eventPromises);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error processing Asana webhook:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

async function processTaskEvent(supabase, event, integration) {
    const taskGid = event.resource.gid;
    const action = event.action;

    try {
        // 1. Fetch task details from Asana using the correct user's token
        const taskResponse = await ky
            .get(
                `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,created_at,modified_at,assignee,projects,tags,custom_fields,permalink_url`,
                {
                    headers: {
                        Authorization: `Bearer ${integration.access_token}`,
                        Accept: 'application/json',
                    },
                    throwHttpErrors: true, // ky will throw an error for non-2xx responses
                },
            )
            .json();

        const taskDetails = taskResponse.data;

        // Ensure task is assigned to the user of this integration to prevent cross-contamination
        if (taskDetails.assignee?.gid !== integration.external_data?.gid) {
            console.log(
                `Task ${taskGid} is not assigned to the integrated user ${integration.external_data?.gid}. Ignoring.`,
            );
            return;
        }

        // 2. Perform database action based on the event type
        const taskPayload = {
            name: taskDetails.name,
            description: taskDetails.notes || null,
            workspace_id: integration.workspace_id,
            integration_source: 'asana',
            external_id: taskDetails.gid,
            external_data: taskDetails,
            host: 'https://app.asana.com',
            assignee: integration.user_id,
            creator: integration.user_id,
            project_id: integration.config?.project_id || null,
        };

        if (action === 'added' || action === 'changed') {
            const { error } = await supabase.from('tasks').upsert(taskPayload, {
                onConflict: 'integration_source, external_id, host, workspace_id',
            });

            if (error) {
                console.error(`Upsert error for task ${taskGid}:`, error);
            } else {
                console.log(`Task ${taskGid} upserted successfully for action: ${action}`);
            }
        } else if (action === 'deleted') {
            // ✅ Corrected from 'removed'
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'asana')
                .eq('external_id', taskGid);

            if (error) {
                console.error(`Delete error for task ${taskGid}:`, error);
            } else {
                console.log(`Task ${taskGid} deleted successfully`);
            }
        }
    } catch (error) {
        // Handle cases where the task might not be accessible or the API call fails
        console.error(
            `Failed to process event for task ${taskGid}. Action: ${action}. Error:`,
            error.response ? await error.response.json() : error.message,
        );
    }
}
