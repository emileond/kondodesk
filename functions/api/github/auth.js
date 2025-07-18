import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../src/utils/dateUtils.js';
import { App, Octokit } from 'octokit';
import { markdownToTipTap } from '../../../src/utils/editorUtils.js';

// Handle DELETE requests for disconnecting GitHub integration
export async function onRequestDelete(context) {
    try {
        const body = await context.request.json();
        const { id, installation_id } = body;

        if (!id || !installation_id) {
            return Response.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 },
            );
        }
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        try {
            const app = new App({
                appId: context.env.GITHUB_APP_ID,
                privateKey: context.env.GITHUB_PRIVATE_KEY,
            });

            const octokit = await app.getInstallationOctokit(installation_id);

            await octokit.request(`DELETE /app/installations/${installation_id}`);

            console.log(`Successfully revoked GitHub installation: ${installation_id}`);
        } catch (revokeError) {
            console.error('Error revoking GitHub installation:', revokeError);
            return Response.error();
        }

        // Get user_id before deleting the integration
        const { data, error } = await supabase
            .from('user_integrations')
            .select('user_id, workspace_id')
            .eq('type', 'github')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching GitHub integration from database:', error);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        const { user_id, workspace_id } = data;

        // Delete the token from the database
        const { error: deleteError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('type', 'github')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting GitHub integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'github')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting GitHub integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating GitHub OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id, installation_id } = body;

    if (!code || !user_id || !workspace_id || !installation_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Exchange code for access token
        const tokenResponse = await ky
            .post('https://github.com/login/oauth/access_token', {
                json: {
                    client_id: context.env.GITHUB_CLIENT_ID,
                    client_secret: context.env.GITHUB_CLIENT_SECRET,
                    code: code,
                },
                headers: { Accept: 'application/json' },
            })
            .json();

        const tokenData = await tokenResponse;

        if (tokenData.error || !tokenData.access_token) {
            console.error('GitHub token exchange error:', tokenData);
            throw new Error(tokenData.error_description || 'Failed to get GitHub access token');
        }

        // 2. Save the initial integration data
        const expires_at = tokenData.expires_in
            ? calculateExpiresAt(tokenData.expires_in - 600)
            : null;
        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'github',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            installation_id,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            expires_at,
            config: { syncStatus: 'prompt' },
        });

        if (upsertError) throw new Error('Failed to save integration data');

        // 3. Process all assigned issues using pagination and batching
        console.log('Starting GitHub initial issue sync...');
        const octokit = new Octokit({ auth: tokenData.access_token });
        const DB_BATCH_SIZE = 50;

        // Use the paginate method with a callback to process each page as it arrives
        await octokit.paginate(
            'GET /issues',
            { filter: 'assigned', state: 'open', per_page: 100 },
            (response, done) => {
                const pageIssues = response.data;

                // Create an async function to process batches within the synchronous callback
                const processBatches = async () => {
                    for (let i = 0; i < pageIssues.length; i += DB_BATCH_SIZE) {
                        const batch = pageIssues.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((issue) => {
                            // Skip pull requests, which are also returned by the issues endpoint
                            if (issue.pull_request) {
                                return Promise.resolve();
                            }
                            const convertedDesc = issue.body ? markdownToTipTap(issue.body) : null;
                            return supabase.from('tasks').upsert(
                                {
                                    name: issue.title,
                                    description: convertedDesc
                                        ? JSON.stringify(convertedDesc)
                                        : null,
                                    workspace_id,
                                    integration_source: 'github',
                                    external_id: issue.id.toString(), // Ensure external_id is a string
                                    external_data: issue,
                                    host: 'https://github.com',
                                    assignee: user_id,
                                    creator: user_id,
                                },
                                {
                                    onConflict:
                                        'integration_source, external_id, host, workspace_id',
                                },
                            );
                        });
                        await Promise.all(upsertPromises);
                    }
                };

                // Although the callback itself isn't async, we can call and await an async function inside it.
                return processBatches();
            },
        );

        console.log('GitHub initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in GitHub auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
