import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';
import ky from 'ky';

// Fetch integration for a specific workspace / integration type
const fetchIntegration = async ({ user_id, type }) => {
    const { data, error } = await supabaseClient
        .from('user_integrations')
        .select('id, status, installation_id, config')
        .eq('user_id', user_id)
        .eq('type', type)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        } else {
            throw new Error('Failed to fetch integration');
        }
    }

    return data;
};

// Hook to fetch projects
export const useUserIntegration = (user_id, type) => {
    return useQuery({
        queryKey: ['user_integration', user_id, type],
        queryFn: () =>
            fetchIntegration({
                user_id,
                type,
            }),
        staleTime: 1000 * 60 * 60, // 60 minutes
        enabled: !!type && !!user_id,
    });
};

// Delete integration
const deleteIntegration = async ({ id, installation_id, type }) => {
    try {
        if (type === 'github' && installation_id) {
            await ky.delete('/api/github/auth', {
                json: { id, installation_id },
            });
        } else if (type === 'trello' && id) {
            await ky.delete('/api/trello/auth', {
                json: { id },
            });
        } else if (type === 'todoist' && id) {
            await ky.delete('/api/todoist/auth', {
                json: { id },
            });
        } else if (type === 'ticktick' && id) {
            await ky.delete('/api/ticktick/auth', {
                json: { id },
            });
        } else if (type === 'clickup' && id) {
            await ky.delete('/api/clickup/auth', {
                json: { id },
            });
            console.log('ClickUp integration deletion API call successful.');
        } else if (type === 'jira' && id) {
            await ky.delete('/api/jira/auth', {
                json: { id },
            });
        } else if (type === 'asana' && id) {
            await ky.delete('/api/asana/auth', {
                json: { id },
            });
        } else if (type === 'microsoft' && id) {
            await ky.delete('/api/microsoft/disconnect', {
                json: { id },
            });
        } else if (type === 'google_tasks' && id) {
            await ky.delete('/api/google/tasks/auth', {
                json: { id },
            });
        } else if (type === 'zoho_projects' && id) {
            await ky.delete('/api/zoho/projects/auth', {
                json: { id },
            });
        } else if (type === 'nifty' && id) {
            await ky.delete('/api/nifty/auth', {
                json: { id },
            });
        } else {
            // Optional: Handle cases where type is not recognized or parameters are missing
            console.warn('Delete operation skipped: Invalid type or missing parameters.', {
                type,
                id,
                installation_id,
            });
            throw new Error('Invalid type or missing parameters for deletion.');
        }

        // If we reach here, the specific operation was successful
        return { success: true, message: `${type} integration deleted successfully.` };
    } catch (error) {
        console.error(`Failed to delete ${type} integration:`, error);

        // Ky throws HTTPError for non-2xx responses, which has a `response` property
        if (error.name === 'HTTPError') {
            const errorBody = await error.response.json().catch(() => error.response.text());
            throw new Error(`API error: ${error.message}`);
        }

        // For other errors (e.g., network issues, Supabase errors re-thrown)
        throw error;
    }
};

// Update integration config
const updateIntegrationConfig = async ({ id, config }) => {
    const { error } = await supabaseClient
        .from('user_integrations')
        .update({ config })
        .eq('id', id);

    if (error) {
        throw new Error('Failed to update integration config');
    }

    return { success: true };
};

// Hook to update an integration's config
export const useUpdateIntegrationConfig = (user_id, type) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateIntegrationConfig,
        onSuccess: () => {
            // Invalidate the relevant query
            queryClient.invalidateQueries({
                queryKey: ['user_integration', user_id, type],
                exact: true,
            });
        },
    });
};

// Fetch all active integrations for a user
const fetchActiveIntegrations = async ({ user_id }) => {
    const { data, error } = await supabaseClient
        .from('user_integrations')
        .select('id, type, status, installation_id, config')
        .eq('user_id', user_id)
        .eq('status', 'active');

    if (error) {
        throw new Error('Failed to fetch active integrations');
    }

    return data || [];
};

// Hook to fetch all active integrations for a user
export const useActiveIntegrations = (user_id) => {
    return useQuery({
        queryKey: ['active_integrations', user_id],
        queryFn: () => fetchActiveIntegrations({ user_id }),
        staleTime: 1000 * 60 * 60, // 60 minutes
        enabled: !!user_id,
    });
};

// Hook to delete an integration
export const useDeleteIntegration = (user_id, type) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteIntegration,
        onSuccess: () => {
            // Invalidate the relevant query
            queryClient.invalidateQueries({
                queryKey: ['user_integration', user_id, type],
                exact: true,
            });
            // Also invalidate the active integrations query
            queryClient.invalidateQueries({
                queryKey: ['active_integrations', user_id],
                exact: true,
            });
        },
    });
};
