import { createClient } from '@supabase/supabase-js';

const validateAworkWebhook = async (request, secret, payload) => {
    // Get the signature from the headers
    const signature = request.headers.get('X-Awork-Signature');

    if (!signature || !signature.startsWith('sha256=')) {
        return false;
    }

    // Extract the hash from the signature
    const receivedHash = signature.substring(7); // Remove 'sha256=' prefix

    // Convert the secret to a key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );

    // Calculate the expected signature
    const payloadData = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert the signature to hex
    const signatureBytes = new Uint8Array(signatureBuffer);
    const expectedHash = Array.from(signatureBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    // Use a constant-time comparison to prevent timing attacks
    if (receivedHash.length !== expectedHash.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < receivedHash.length; i++) {
        result |= receivedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }

    return result === 0;
};

export async function onRequestPost(context) {
    try {
        // Get the raw payload as text for signature validation
        const rawPayload = await context.request.text();

        // Validate the webhook signature if secret is provided
        if (context.env.AWORK_WEBHOOK_SECRET) {
            const isValid = await validateAworkWebhook(
                context.request,
                context.env.AWORK_WEBHOOK_SECRET,
                rawPayload,
            );

            if (!isValid) {
                return Response.json(
                    { success: false, error: 'Invalid webhook signature' },
                    { status: 401 },
                );
            }
        }

        // Parse the webhook payload
        const payload = JSON.parse(rawPayload);

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Extract the webhook event type and task data
        const event = payload.eventType;
        const task = payload.data;

        if (!event || !task) {
            return Response.json(
                { success: false, error: 'Invalid webhook payload' },
                { status: 400 },
            );
        }

        // Handle different event types
        if (event === 'task.updated' || event === 'task.created') {
            // Convert description to Tiptap format if available
            const tiptapDescription = task.description ? JSON.stringify({
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{
                        type: 'text',
                        text: task.description
                    }]
                }]
            }) : null;

            // Update the task in the database
            const { data: updateData, error: updateError } = await supabase
                .from('tasks')
                .update({
                    name: task.name,
                    description: tiptapDescription,
                    external_data: task,
                })
                .eq('integration_source', 'awork')
                .eq('external_id', task.id.toString())
                .eq('host', 'https://app.awork.com')
                .select();

            if (updateError) {
                console.error(`Update error for task ${task.id}:`, updateError);
                return Response.json(
                    { success: false, error: 'Failed to update task' },
                    { status: 500 },
                );
            }

            if (!updateData || updateData.length === 0) {
                console.log(`No task found for Awork task ${task.id}`);
                return Response.json({ success: false, error: 'Task not found' }, { status: 404 });
            }

            console.log(`Task for Awork task ${task.id} updated successfully`);
            return Response.json({ success: true });
        }

        if (event === 'task.deleted') {
            // Delete the task from the database
            const { data: deleteData, error: deleteError } = await supabase
                .from('tasks')
                .delete()
                .eq('integration_source', 'awork')
                .eq('external_id', task.id.toString())
                .eq('host', 'https://app.awork.com')
                .select();

            if (deleteError) {
                console.error(`Delete error for task ${task.id}:`, deleteError);
                return Response.json(
                    { success: false, error: 'Failed to delete task' },
                    { status: 500 },
                );
            }

            if (!deleteData || deleteData.length === 0) {
                console.log(`No task found for Awork task ${task.id}`);
                return Response.json({ success: false, error: 'Task not found' }, { status: 404 });
            }

            console.log(`Task for Awork task ${task.id} deleted successfully`);
            return Response.json({ success: true });
        }

        // If we reach here, the webhook event type is not supported
        return Response.json(
            { success: false, error: 'Unsupported webhook event' },
            { status: 400 },
        );
    } catch (error) {
        console.error('Error processing Awork webhook:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
                details: error.message,
            },
            { status: 500 },
        );
    }
}