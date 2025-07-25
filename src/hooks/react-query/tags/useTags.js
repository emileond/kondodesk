import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch tags for a specific workspace
const fetchTags = async ({ workspace_id }) => {
    const { data, error } = await supabaseClient
        .from('tags')
        .select('*')
        .eq('workspace_id', workspace_id);
    if (error) {
        throw new Error('Failed to fetch tags');
    }

    return data;
};

// Hook to fetch tags
export const useTags = (currentWorkspace = {}) => {
    return useQuery({
        queryKey: ['tags', currentWorkspace?.workspace_id],
        queryFn: () =>
            fetchTags({
                workspace_id: currentWorkspace?.workspace_id,
            }),
        staleTime: 1000 * 60 * 15, // 15 minutes
        enabled: !!currentWorkspace?.workspace_id, // Only fetch if workspace_id is provided
    });
};

// Function to create a new tag
const createTag = async ({ tag }) => {
    const { data, error } = await supabaseClient.from('tags').insert(tag).select().single();

    if (error) {
        throw new Error('Failed to create tag');
    }

    return data;
};

// Hook to create a new tag
export const useCreateTag = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createTag,
        onSuccess: () => {
            // Invalidate and refetch the tags query for the workspace
            queryClient.invalidateQueries({ queryKey: ['tags', currentWorkspace?.workspace_id] });
        },
    });
};

// Function to update a tag's name, color, or other properties
const updateTag = async ({ tagId, updates }) => {
    const { error } = await supabaseClient.from('tags').update(updates).eq('id', tagId);

    if (error) {
        throw new Error('Failed to update tag');
    }
};

// Hook to update a tag
export const useUpdateTag = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateTag,
        onError: (error) => {
            console.error('Error updating tags:', error);
        },
        onSuccess: () => {
            // Invalidate and refetch the tags query for the workspace
            queryClient.invalidateQueries({ queryKey: ['tags', currentWorkspace?.workspace_id] });
        },
    });
};

// Function to delete a tag
const deleteTag = async ({ tagId }) => {
    const { error } = await supabaseClient.from('tags').delete().eq('id', tagId);

    if (error) {
        throw new Error('Failed to delete tag');
    }
};

// Hook to delete a tag
export const useDeleteTag = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tagId }) => deleteTag({ tagId }),
        onError: (error) => {
            console.error('Error deleting tag:', error);
        },
        onSuccess: () => {
            // Invalidate and refetch the tags query for the workspace
            queryClient.invalidateQueries({ queryKey: ['tags', currentWorkspace?.workspace_id] });
        },
    });
};
