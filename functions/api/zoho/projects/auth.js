import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC, calculateExpiresAt } from '../../../../src/utils/dateUtils.js';

// Handle DELETE requests for disconnecting Zoho Projects integration
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
            .eq('type', 'zoho_projects')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching Zoho Projects integration from database:', error);
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
            .eq('type', 'zoho_projects')
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting Zoho Projects integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'zoho_projects')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Zoho Projects integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // 1. Exchange code for access token
        const params = new URLSearchParams();
        params.append('client_id', context.env.ZOHO_PROJECTS_CLIENT_ID);
        params.append('client_secret', context.env.ZOHO_PROJECTS_CLIENT_SECRET);
        params.append('code', code);
        params.append(
            'redirect_uri',
            'https://weekfuse.com/integrations/oauth/callback/zoho_projects',
        );
        params.append('grant_type', 'authorization_code');

        const tokenResponse = await ky
            .post('https://accounts.zoho.com/oauth/v2/token', {
                body: params, // Use the 'body' option with URLSearchParams
            })
            .json();

        const { access_token, refresh_token, expires_in, api_domain } = tokenResponse;

        if (!access_token || !api_domain) {
            console.error('Zoho Projects token exchange error:', tokenResponse);
            throw new Error(
                tokenResponse.error || 'Failed to get Zoho Projects access token or api_domain',
            );
        }

        // ✅ All API calls now use the standard token
        const headers = {
            Authorization: `Zoho-oauthtoken ${access_token}`,
            Accept: 'application/json',
        };

        console.log(access_token);

        // 2. Fetch the Portal ID first
        const portalsResponse = await ky
            .get(`https://projectsapi.zoho.com/api/v3/portals`, { headers })
            .json();
        if (portalsResponse.length === 0) {
            throw new Error('No Zoho Projects portals found for this user.');
        }
        const portals = portalsResponse;

        // 2. Save the initial integration data
        const expires_at = expires_in ? calculateExpiresAt(expires_in - 600) : null;
        const { data: integrationData, error: upsertError } = await supabase
            .from('user_integrations')
            .upsert({
                type: 'zoho_projects',
                access_token,
                refresh_token,
                user_id,
                workspace_id,
                status: 'active',
                last_sync: toUTC(),
                expires_at,
                config: { syncStatus: 'prompt' },
                external_data: { api_domain, portals: portals.map((portal) => portal.id) },
            })
            .select('id')
            .single();

        if (upsertError) throw new Error('Failed to save integration data');
        // const integration_id = upsertData.id;

        // 4. Fetch user profile to get user details
        // Get user profile
        // try {
        //     const userProfile = await ky.get(`${api_domain}/api/users/me/`, { headers }).json();
        //
        //     await supabase
        //         .from('user_integrations')
        //         .update({ external_data: userProfile })
        //         .eq('id', integration_id);
        // } catch (userDataError) {
        //     console.error('Could not fetch Zoho Projects user data:', userDataError);
        // }

        // 5. Fetch projects accessible to the user
        // const projectsResponse = await ky
        //     .get(`${api_domain}/api/portals/${portal_id}/projects/`, { headers })
        //     .json();
        //
        // const projects = projectsResponse.projects || [];
        //
        // if (projects.length === 0) {
        //     console.log('No accessible Zoho Projects found.');
        //     return Response.json({
        //         success: true,
        //         message: 'Integration connected, no projects found.',
        //     });
        // }

        // 5. Process tasks for each project with pagination and batching
        const DB_BATCH_SIZE = 50;
        const API_MAX_RESULTS = 200; // Zoho Projects API limit

        const userProfileResponse = await ky
            .get(`https://projectsapi.zoho.com/api/v3/portal/${portals[0].id}/users/me`, {
                headers,
            })
            .json();
        const zoho_user_id = userProfileResponse.id;

        const filterObject = [
            {
                criteria: [
                    {
                        api_name: 'owner_id',
                        criteria_condition: 'in',
                        value: [zoho_user_id],
                    },
                    // {
                    //     api_name: 'status_type',
                    //     criteria_condition: 'equals',
                    //     value: 'open',
                    // },
                ],
                pattern: '1AND2',
            },
        ];

        const filterParam = encodeURIComponent(JSON.stringify(filterObject));

        for (const portal of portals) {
            try {
                console.log(`Processing tasks for portal: ${portal.portal_name} (${portal.id})`);
                let page = 1;
                let hasMoreTasks = true;

                // Loop through all pages of tasks from the Zoho Projects API
                while (hasMoreTasks) {
                    const url = `https://projectsapi.zoho.com/api/v3/portal/${portal.id}/tasks?page=${page}&per_page=100&filter=${filterParam}`;
                    const pageData = await ky.get(url, { headers }).json();
                    const pageTasks = pageData.tasks || [];

                    // Process the current page of tasks in batches
                    for (let i = 0; i < pageTasks.length; i += DB_BATCH_SIZE) {
                        const batch = pageTasks.slice(i, i + DB_BATCH_SIZE);
                        const upsertPromises = batch.map((task) => {
                            return supabase.from('tasks').upsert(
                                {
                                    name: task.name,
                                    description: task.description || null,
                                    workspace_id,
                                    integration_source: 'zoho_projects',
                                    external_id: task.id,
                                    external_data: task,
                                    host: task.link.web.url,
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

                    // Check if we've reached the last page
                    if (pageTasks.length < API_MAX_RESULTS) {
                        hasMoreTasks = false;
                    } else {
                        index += API_MAX_RESULTS;
                    }
                }
                console.log(`Processed tasks from portal ${portal.name}.`);
            } catch (portalError) {
                console.error(`Failed to process portal ${portal.id}:`, portalError);
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in Zoho Projects auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
