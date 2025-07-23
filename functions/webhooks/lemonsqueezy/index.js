import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const getPlanName = (productName) => {
    const lowerCaseName = productName.toLowerCase();
    if (lowerCaseName.includes('personal')) {
        return 'personal';
    }
    if (lowerCaseName.includes('team')) {
        return 'team';
    }
    return null;
};

const verifySignature = async (request, secret) => {
    try {
        const signature = request.headers.get('X-Signature');
        if (!signature) {
            console.error('Signature header missing.');
            return false;
        }

        const rawBody = await request.clone().text();
        const encoder = new TextEncoder();

        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );

        const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
        const hash = Array.from(new Uint8Array(signed))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return crypto.timingSafeEqual(encoder.encode(hash), encoder.encode(signature));
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
};

export const onRequestPost = async (context) => {
    const { request, env } = context;

    const secret = env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
        console.error('LEMON_SQUEEZY_WEBHOOK_SECRET environment variable not set.');
        return new Response('Internal Server Error', { status: 500 });
    }

    const isSignatureValid = await verifySignature(request, secret);
    if (!isSignatureValid) {
        return new Response('Invalid signature.', { status: 401 });
    }

    try {
        const body = await request.json();
        // It's best practice to use the SERVICE_KEY for server-side functions
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        const { event_name: eventName, custom_data: customData } = body.meta;
        const { workspace_id: workspaceId, user_id: userId } = customData;
        const attributes = body.data.attributes;
        const firstOrderItem = attributes.first_order_item;

        switch (eventName) {
            case 'order_created': {
                // First, create the order record for all purchases
                const orderData = {
                    lemon_id: body.data.id,
                    workspace_id: workspaceId,
                    user_id: userId,
                    order_status: attributes.status,
                    amount_total: attributes.total,
                    currency: attributes.currency,
                    receipt_url: attributes.urls.receipt,
                    purchased_at: attributes.created_at,
                };

                const { error: orderError } = await supabase.from('orders').upsert(orderData, {
                    onConflict: 'lemon_id',
                });

                if (orderError) throw orderError;

                // If the order is for an LTD variant, update the workspace directly.
                if (firstOrderItem?.variant_name === 'LTD') {
                    const plan = getPlanName(firstOrderItem.product_name);
                    const teamSeats = plan === 'team' ? 25 : 1;
                    const guestSeats = plan === 'team' ? 1000 : 3;
                    const workspaceUpdate = {
                        plan: plan,
                        subscription_status: 'active',
                        is_ltd: true,
                        team_seats: teamSeats,
                        guest_seats: guestSeats,
                        lemon_customer_id: attributes.customer_id,
                    };

                    const { error: workspaceError } = await supabase
                        .from('workspaces')
                        .update(workspaceUpdate)
                        .eq('id', workspaceId);

                    if (workspaceError) throw workspaceError;
                }
                break;
            }

            case 'subscription_created':
            case 'subscription_updated':
            case 'subscription_plan_changed':
            case 'subscription_resumed': {
                const plan = getPlanName(firstOrderItem.product_name);
                const teamSeats = plan === 'team' ? 25 : 1;
                const guestSeats = plan === 'team' ? 1000 : 3;

                const subscriptionData = {
                    workspace_id: workspaceId,
                    // The subscription ID is on the subscription object itself, not the order item
                    lemon_id: body.data.id,
                    lemon_customer_id: attributes.customer_id,
                    status: attributes.status,
                    plan: plan,
                    team_seats: teamSeats,
                    guest_seats: guestSeats,
                    renews_at: attributes.renews_at,
                    ends_at: attributes.ends_at,
                    trial_ends_at: attributes.trial_ends_at,
                    update_payment_url: attributes.urls.update_payment_method,
                    customer_portal_url: attributes.urls.customer_portal,
                };

                const { error: subError } = await supabase
                    .from('subscriptions')
                    .upsert(subscriptionData, {
                        onConflict: 'lemon_id',
                    });
                if (subError) throw subError;

                // --- MODIFIED LOGIC ---
                // Update the workspace snapshot. Note the is_ltd field is removed.
                const workspaceUpdate = {
                    plan: getPlanName(attributes.product_name),
                    subscription_status: attributes.status,
                    lemon_customer_id: attributes.customer_id,
                    // is_ltd will never be true for a subscription, so we don't set it.
                    // It will remain false (its default value).
                    is_ltd: false,
                };

                const { error: workspaceError } = await supabase
                    .from('workspaces')
                    .update(workspaceUpdate)
                    .eq('id', workspaceId);

                if (workspaceError) throw workspaceError;
                break;
            }

            case 'subscription_cancelled':
            case 'subscription_expired': {
                const status = eventName === 'subscription_expired' ? 'expired' : 'cancelled';

                const { error: subError } = await supabase
                    .from('subscriptions')
                    .update({ status: status, ends_at: attributes.ends_at })
                    .eq('lemon_id', body.data.id);
                if (subError) throw subError;

                const { error: workspaceError } = await supabase
                    .from('workspaces')
                    .update({ subscription_status: status })
                    .eq('lemon_customer_id', attributes.customer_id);
                if (workspaceError) throw workspaceError;

                break;
            }

            // --- Other events remain unchanged ---
            case 'subscription_payment_success':
            case 'subscription_payment_failed':
            case 'subscription_payment_recovered':
                console.log(
                    `Received payment event: ${eventName} for customer ${attributes.customer_id}`,
                );
                break;

            default:
                console.log(`Webhook event not handled: ${eventName}`);
                return new Response('Webhook event not handled', { status: 200 });
        }

        return new Response('Webhook processed successfully', { status: 200 });
    } catch (error) {
        console.error('Error processing webhook:', error.message);
        return new Response('Internal Server Error', { status: 500 });
    }
};
