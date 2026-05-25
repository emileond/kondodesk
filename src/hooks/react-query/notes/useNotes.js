import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';
import ky from 'ky';

// Fetch notes for a specific workspace
const fetchNotes = async ({ id, condo_id, from }) => {
    let query = supabaseClient.from('announcements').select('*').eq('condo_id', condo_id);

    if (id) {
        query = query.eq('id', id).single(); // Fetch single item
    } else {
        if (from) {
            query = query.gte('created_at', from);
        }
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
                from: filters.id ? null : filters.from,
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!currentWorkspace?.condo_id, // Only fetch if condo_id is provided
    });
};

// Function to create a new note
const createNote = async ({ note, notifyResidents = false }) => {
    const { data, error } = await supabaseClient.from('announcements').insert(note).select();

    if (error) {
        throw new Error('Failed to create note');
    }

    const createdNote = data[0];
    let notifyError = null;

    if (notifyResidents && createdNote?.condo_id) {
        try {
            await ky.post('/api/announcements/notify', {
                json: {
                    condo_id: createdNote.condo_id,
                    title: createdNote.title,
                    content: createdNote.content,
                    note_id: createdNote.id,
                },
                timeout: 30000,
            });
        } catch (error) {
            notifyError = error?.message || 'Failed to notify residents';
            console.error('Failed to notify residents:', error);
        }
    }

    return { note: createdNote, notifyError };
};

// Hook to create a new note
export const useCreateNote = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: createNote,
        onSuccess: () => {
            // Invalidate all announcement queries for this condo/workspace
            queryClient.invalidateQueries({
                predicate: ({ queryKey }) =>
                    queryKey?.[0] === 'announcements' &&
                    (condoId ? queryKey?.[1] === condoId : true),
                refetchType: 'all',
            });
        },
    });
};

// Function to update a note
const updateNote = async ({ noteId, updates }) => {
    const { error } = await supabaseClient.from('announcements').update(updates).eq('id', noteId);

    if (error) {
        throw new Error('Failed to update note');
    }
};

// Hook to update a note
export const useUpdateNote = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: updateNote,
        onError: (error) => {
            console.error('Error updating note:', error);
        },
        onSuccess: () => {
            // Invalidate all announcement queries for this condo/workspace
            queryClient.invalidateQueries({
                predicate: ({ queryKey }) =>
                    queryKey?.[0] === 'announcements' &&
                    (condoId ? queryKey?.[1] === condoId : true),
                refetchType: 'all',
            });
        },
    });
};

// Function to delete a note
const deleteNote = async ({ noteId, condoId }) => {
    let query = supabaseClient.from('announcements').delete().eq('id', noteId);
    if (condoId) {
        query = query.eq('condo_id', condoId);
    }

    const { data, error } = await query.select('id');

    if (error) {
        throw error;
    }
    return data;
};

// Hook to delete a note
export const useDeleteNote = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: ({ noteId }) => deleteNote({ noteId, condoId }),
        onError: (error) => {
            console.error('Error deleting note:', error);
        },
        onSuccess: () => {
            // Invalidate all announcement queries for this condo/workspace
            queryClient.invalidateQueries({
                predicate: ({ queryKey }) =>
                    queryKey?.[0] === 'announcements' &&
                    (condoId ? queryKey?.[1] === condoId : true),
                refetchType: 'all',
            });
        },
    });
};
