import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch notes for a specific workspace
const fetchNotes = async ({ id, condo_id }) => {
    let query = supabaseClient.from('announcements').select('*').eq('condo_id', condo_id);

    if (id) {
        query = query.eq('id', id).single(); // Fetch single item
    } else {
        query = query.order('created_at', { ascending: false }); // Order by created_at descending
    }

    const { data, error } = await query;

    if (error) {
        throw new Error('Failed to fetch notes');
    }

    return data;
};

// Hook to fetch notes with optional filters
export const useNotes = (currentWorkspace, filters = {}) => {
    return useQuery({
        queryKey: ['announcements', currentWorkspace?.condo_id, filters],
        queryFn: () =>
            fetchNotes({
                condo_id: currentWorkspace?.condo_id,
                id: filters.id,
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!currentWorkspace?.condo_id, // Only fetch if condo_id is provided
    });
};

// Function to create a new note
const createNote = async ({ note }) => {
    const { data, error } = await supabaseClient.from('announcements').insert(note).select();

    if (error) {
        throw new Error('Failed to create note');
    }

    return data[0];
};

// Hook to create a new note
export const useCreateNote = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createNote,
        onSuccess: () => {
            // Invalidate all note-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['announcements', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
        },
    });
};

// Function to update a note
const updateNote = async ({ noteId, updates }) => {
    const { error } = await supabaseClient.from('notes').update(updates).eq('id', noteId);

    if (error) {
        throw new Error('Failed to update note');
    }
};

// Hook to update a note
export const useUpdateNote = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateNote,
        onError: (error) => {
            console.error('Error updating note:', error);
        },
        onSuccess: () => {
            // Invalidate all note-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['announcements', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
        },
    });
};

// Function to delete a note
const deleteNote = async ({ noteId }) => {
    const { error } = await supabaseClient.from('notes').delete().eq('id', noteId);

    if (error) {
        throw new Error('Failed to delete note');
    }
};

// Hook to delete a note
export const useDeleteNote = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ noteId }) => deleteNote({ noteId }),
        onError: (error) => {
            console.error('Error deleting note:', error);
        },
        onSuccess: () => {
            // Invalidate all note-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['announcements', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
        },
    });
};
