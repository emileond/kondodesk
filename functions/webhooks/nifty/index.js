import { createClient } from '@supabase/supabase-js';

const validateNiftyWebhook = async (request, secret, payload) => {
    // Get the signature from the headers
    const signature = request.headers.get('X-Nifty-Signature');

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

        // Validate the webhook signature
        const isValid = await validateNiftyWebhook(
            context.request,
            context.env.NIFTY_WEBHOOK_SECRET,
            rawPayload,
        );

        if (!isValid) {
            return Response.json(
                { success: false, error: 'Invalid webhook signature' },
                { status: 401 },
            );
        }

        // Parse the webhook payload
        const payload = JSON.parse(rawPayload);

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Extract the webhook event type and task data
        const event = context.request.headers.get('X-Nifty-Event');
        const task = payload.task;

        if (!event || !task) {
            return Response.json(
                { success: false, error: 'Invalid webhook payload' },
                { status: 400 },
            );
        }

        // Only handle task events
        if (event === 'task.updated' || event === 'task.created') {
            // Convert description to Tiptap format if available
            const tiptapDescription = task.description ? {
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{
                        type: 'text',
                        text: task.description
                    }]
                }]
            } : null;

            // Update the task in the database
            const { data: updateData, error: updateError } = await supabase
                .from('tasks')
                .update({
                    name: task.title,
                    description: tiptapDescription ? JSON.stringify(tiptapDescription) : null,
                    external_data: task,
                })
                .eq('integration_source', 'nifty')
                .eq('external_id', task.id)
                .eq('host', 'https://nifty.pm')
                .select();

            if (updateError) {
                console.error(`Update error for task ${task.id}:`, updateError);
                return Response.json(
                    { success: false, error: 'Failed to update task' },
                    { status: 500 },
                );
            }

            if (!updateData || updateData.length === 0) {
                console.log(`No task found for Nifty task ${task.id}`);
                return Response.json({ success: false, error: 'Task not found' }, { status: 404 });
            }

            console.log(`Task for Nifty task ${task.id} updated successfully`);
            return Response.json({ success: true });
        }

        // If we reach here, the webhook event type is not supported
        return Response.json(
            { success: false, error: 'Unsupported webhook event' },
            { status: 400 },
        );
    } catch (error) {
        console.error('Error processing Nifty webhook:', error);
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