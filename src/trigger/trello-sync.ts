import { logger, task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../utils/dateUtils';
import ky from 'ky';
import { markdownToTipTap } from '../utils/editorUtils';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
);

export const trelloSync = task({
    id: 'trello-sync',
    maxDuration: 3600, // 60 minutes max duration
    run: async (payload: any) => {
        logger.log('Starting Trello sync task');

        try {
            // Update the last_sync timestamp
            await supabase
                .from('user_integrations')
                .update({
                    last_sync: toUTC(),
                })
                .eq('id', payload.id);

            const access_token = payload.access_token;

            // Get project_id from integration config if available
            const project_id = payload.config?.project_id || null;

            // Get boards the member belongs to
            const boards = await ky
                .get(
                    `https://api.trello.com/1/members/me/boards?key=${process.env.TRELLO_API_KEY}&token=${access_token}`,
                    {
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                )
                .json();

            // Get all cards from boards that are visible to the member
            let allCards = [];

            // Iterate through each board and get all cards
            if (boards && Array.isArray(boards)) {
                const cardPromises = boards.map((board) => {
                    const boardCardsUrl = `https://api.trello.com/1/boards/${board.id}/cards/open?key=${process.env.TRELLO_API_KEY}&token=${access_token}`;
                    return ky
                        .get(boardCardsUrl, {
                            headers: {
                                Accept: 'application/json',
                            },
                        })
                        .json();
                });

                const boardCardsResults = await Promise.all(cardPromises);

                // Combine all cards from all boards
                allCards = boardCardsResults.flat();
            }

            const cardsData = allCards;

            // Process and store cards
            if (cardsData && Array.isArray(cardsData)) {
                // Define a batch size
                const BATCH_SIZE = 50;
                let cardSuccessCount = 0;
                let cardFailCount = 0;

                logger.log(
                    `Starting to process ${cardsData.length} cards in batches of ${BATCH_SIZE}.`,
                );

                for (let i = 0; i < cardsData.length; i += BATCH_SIZE) {
                    const batch = cardsData.slice(i, i + BATCH_SIZE);

                    const upsertPromises = batch.map((card) => {
                        const tiptapDescription = card?.desc ? markdownToTipTap(card.desc) : null;

                        return supabase.from('tasks').upsert(
                            {
                                name: card.name,
                                description: tiptapDescription,
                                workspace_id: payload.workspace_id,
                                integration_source: 'trello',
                                external_id: card.id,
                                external_data: card,
                                host: card.url,
                                assignee: payload.user_id,
                                creator: payload.user_id,
                                project_id: project_id,
                            },
                            {
                                onConflict: 'integration_source, external_id, host, workspace_id',
                            },
                        );
                    });

                    // Await the completion of the current batch before starting the next one
                    const results = await Promise.all(upsertPromises);

                    results.forEach((result, index) => {
                        if (result.error) {
                            // The card ID comes from the 'batch' array now
                            logger.error(
                                `Upsert error for card ${batch[index].id}: ${result.error.message}`,
                            );
                            cardFailCount++;
                        } else {
                            cardSuccessCount++;
                        }
                    });
                }

                logger.log(
                    `Processed ${cardsData.length} cards for workspace ${payload.workspace_id}: ${cardSuccessCount} succeeded, ${cardFailCount} failed`,
                );
            }

            logger.log(
                `Successfully synced Trello integration for workspace ${payload.workspace_id}`,
            );
        } catch (error) {
            console.log(error);
            logger.error(
                `Error syncing Trello integration for workspace ${payload.workspace_id}: ${error.message}`,
            );
        }

        return {
            success: true,
        };
    },
});
