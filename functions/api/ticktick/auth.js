import ky from 'ky';
import { createClient } from '@supabase/supabase-js';
import { toUTC } from '../../../src/utils/dateUtils.js';
import { markdownToTipTap } from '../../../src/utils/editorUtils.js';

// Handle DELETE requests for disconnecting TickTick integration
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
            .select('access_token, refresh_token, user_id, workspace_id')
            .eq('type', 'ticktick')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching TickTick integration from database:', error);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        const { access_token, user_id, workspace_id } = data;

        // Delete the token from the database
        const { error: deleteError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('type', 'ticktick')
            .eq('access_token', access_token);

        if (deleteError) {
            console.error('Error deleting TickTick integration from database:', deleteError);
            return Response.json(
                { success: false, error: 'Failed to delete integration data' },
                { status: 500 },
            );
        }

        // Delete the backlog tasks from the database
        await supabase
            .from('tasks')
            .delete()
            .eq('integration_source', 'ticktick')
            .eq('status', 'pending')
            .eq('creator', user_id)
            .eq('workspace_id', workspace_id)
            .is('date', null);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting TickTick integration:', error);
        return Response.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 },
        );
    }
}

// Handle POST requests for initiating TickTick OAuth flow
export async function onRequestPost(context) {
    const body = await context.request.json();
    const { code, user_id, workspace_id } = body;

    if (!code || !user_id || !workspace_id) {
        return Response.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { TICKTICK_CLIENT_ID, TICKTICK_CLIENT_SECRET } = context.env;

        // 1. Exchange code for access token
        const basicAuthHeader = `Basic ${btoa(`${TICKTICK_CLIENT_ID}:${TICKTICK_CLIENT_SECRET}`)}`;
        const tokenResponse = await ky
            .post('https://ticktick.com/oauth/token', {
                headers: {
                    Authorization: basicAuthHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/ticktick',
                    scope: 'tasks:read tasks:write',
                }),
            })
            .json();

        const { access_token } = tokenResponse;
        if (!access_token) throw new Error('Failed to obtain TickTick access token');

        // 2. Save the initial integration data
        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            type: 'ticktick',
            access_token,
            user_id,
            workspace_id,
            status: 'active',
            last_sync: toUTC(),
            config: { syncStatus: 'prompt' },
        });

        if (upsertError) throw new Error('Failed to save integration data');

        // 3. Fetch all user projects
        const headers = { Authorization: `Bearer ${access_token}` };
        const projects = await ky
            .get('https://api.ticktick.com/open/v1/project', { headers })
            .json();

        // Add the default "Inbox" project which has no ID in the projects list
        const allProjects = [{ id: 'inbox', name: 'Inbox' }, ...(projects || [])];

        // 4. Process tasks project-by-project with DB batching
        const DB_BATCH_SIZE = 50;
        console.log(`Starting initial import for ${allProjects.length} TickTick projects.`);

        for (const project of allProjects) {
            try {
                console.log(`Fetching tasks for project: ${project.name} (${project.id})`);
                const projectData = await ky
                    .get(`https://api.ticktick.com/open/v1/project/${project.id}/data`, { headers })
                    .json();
                const projectTasks = projectData.tasks || [];

                if (projectTasks.length === 0) {
                    console.log(`No tasks found in project: ${project.name}`);
                    continue;
                }

                // Process the tasks for this project in batches
                for (let i = 0; i < projectTasks.length; i += DB_BATCH_SIZE) {
                    const batch = projectTasks.slice(i, i + DB_BATCH_SIZE);
                    const upsertPromises = batch.map((task) => {
                        const tiptapDescription = task.content
                            ? markdownToTipTap(task.content)
                            : null;
                        return supabase.from('tasks').upsert(
                            {
                                name: task.title,
                                description: tiptapDescription
                                    ? JSON.stringify(tiptapDescription)
                                    : null,
                                workspace_id,
                                integration_source: 'ticktick',
                                external_id: task.id,
                                external_data: task,
                                host: `https://ticktick.com/webapp/#p/${task.projectId}/tasks/${task.id}`,
                                assignee: user_id,
                                creator: user_id,
                            },
                            { onConflict: 'integration_source, external_id, host, workspace_id' },
                        );
                    });
                    await Promise.all(upsertPromises);
                }
                console.log(
                    `Successfully processed ${projectTasks.length} tasks from project: ${project.name}`,
                );
            } catch (projectError) {
                console.error(
                    `Failed to process project ${project.name} (${project.id}):`,
                    projectError,
                );
            }
        }

        console.log('TickTick initial import completed successfully.');
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error in TickTick auth flow:', error);
        return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
