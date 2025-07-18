import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../../../src/utils/dateUtils.js';
import { markdownToTipTap } from '../../../src/utils/editorUtils.js';

// Handle DELETE requests for disconnecting Trello integration
export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id } = body;

        if (!id) {
            return Response.json({ success: false, error: 'Missing id' }, { status: 400 });
        }

        // Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        const { data, error } = await supabase
            .from('user_integrations')
            .select('access_token, user_id, workspace_id')
            .eq('type', 'trello')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Trello integration from database:', error);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        const { access_token, user_id, workspace_id } = data;

        try {
            // Revoke the token with Trello's API
            await ky.delete(
                `https://api.trello.com/1/tokens/${access_token}/?key=${context.env.TRELLO_API_KEY}&token=${access_token}`,
                {
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            console.log(`Successfully revoked Trello token: ${access_token}`);
        } catch (revokeError) {
            console.error('Error revoking Trello token:', revokeError);
            // Continue with deletion from database even if API revocation fails
        }

        // Delete the token from the database
        const { error: deleteError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('type', 'trello')
            .eq('access_token', access_token);

        if (deleteError) {
            console.error('Error deleting Trello integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'trello')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Trello integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating Trello OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { access_token, user_id, workspace_id } = body;

    if (!access_token || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Save the access token and create the integration record
        const { error: updateError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'trello',
                access_token: access_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                config: { syncStatus: 'prompt' },
            })
            .select('id')
            .single();

        if (updateError) {
            console.error('Supabase upsert error:', updateError);
            return Response.json(
                { success: false, error: 'Failed to save integration data' },
                { status: 500 },
            );
        }

        // 2. Get all boards the member belongs to
        const boards = await ky
            .get(
                `https://api.trello.com/1/members/me/boards?key=${context.env.TRELLO_API_KEY}&token=${access_token}`,
                { headers: { Accept: 'application/json' } },
            )
            .json();

        if (!boards || !Array.isArray(boards)) {
            console.log('No Trello boards found for this user.');
            return Response.json({
                success: true,
                message: 'Integration connected, no boards found.',
            });
        }

        // 3. Create webhooks for each board
        // This can be done concurrently before the main import begins.
        const webhookUrl = 'https://weekfuse.com/webhooks/trello';
        const webhookPromises = boards.map((board) =>
            ky
                .post(
                    `https://api.trello.com/1/tokens/${access_token}/webhooks/?key=${context.env.TRELLO_API_KEY}`,
                    {
                        json: {
                            description: `Weekfuse webhook for board ${board.name}`,
                            callbackURL: webhookUrl,
                            idModel: board.id,
                        },
                        headers: { 'Content-Type': 'application/json' },
                    },
                )
                .catch((err) => {
                    // Catch errors per-webhook to not fail the whole process
                    console.error(`Error creating webhook for board ${board.id}:`, err);
                }),
        );
        await Promise.allSettled(webhookPromises);
        console.log('Webhook setup process completed.');

        // 4. Process cards board-by-board to manage memory and load
        console.log(`Starting initial import for ${boards.length} boards.`);
        const BATCH_SIZE = 50; // A manageable batch size for DB upserts

        for (const board of boards) {
            try {
                console.log(`Fetching cards for board: ${board.name} (${board.id})`);

                // Fetch all open cards for the current board
                const cardsOnBoard = await ky
                    .get(
                        `https://api.trello.com/1/boards/${board.id}/cards/open?key=${context.env.TRELLO_API_KEY}&token=${access_token}`,
                        { headers: { Accept: 'application/json' } },
                    )
                    .json();

                if (!cardsOnBoard || cardsOnBoard.length === 0) {
                    console.log(`No cards found on board: ${board.name}`);
                    continue; // Move to the next board
                }

                // Process the cards for this board in batches
                for (let i = 0; i < cardsOnBoard.length; i += BATCH_SIZE) {
                    const batch = cardsOnBoard.slice(i, i + BATCH_SIZE);
                    const upsertPromises = batch.map((card) => {
                        const tiptapDescription = card?.desc ? markdownToTipTap(card.desc) : null;
                        return supabase.from('tasks').upsert(
                            {
                                name: card.name,
                                description: tiptapDescription,
                                workspace_id,
                                integration_source: 'trello',
                                external_id: card.id,
                                external_data: card,
                                host: card.url,
                                assignee: user_id,
                                creator: user_id,
                            },
                            { onConflict: 'integration_source, external_id, host, workspace_id' },
                        );
                    });

                    await Promise.all(upsertPromises);
                }
                console.log(
                    `Successfully processed ${cardsOnBoard.length} cards from board: ${board.name}`,
                );
            } catch (boardError) {
                console.error(`Failed to process board ${board.name} (${board.id}):`, boardError);
                // Continue to the next board even if one fails
            }
        }

        console.log('Trello initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Trello auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
