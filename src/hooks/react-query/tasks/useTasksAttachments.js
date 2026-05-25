import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';
import ky from 'ky';

const fetchAttachments = async ({ condo_id }) => {
    if (!condo_id) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from('files')
        .select('*')
        .eq('condo_id', condo_id)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error('Failed to fetch attachments');
    }

    return data;
};

export const useAttachments = (condo_id) => {
    return useQuery({
        queryKey: ['files', condo_id],
        queryFn: () => fetchAttachments({ condo_id }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!condo_id,
    });
};

const renameAttachment = async ({ attachmentId, condoId, name }) => {
    if (!attachmentId || !condoId || !name?.trim()) {
        throw new Error('Attachment ID, condo ID, and name are required.');
    }

    const { error } = await supabaseClient
        .from('files')
        .update({ name: name.trim() })
        .eq('id', attachmentId)
        .eq('condo_id', condoId);

    if (error) {
        throw new Error('Failed to rename attachment.');
    }
};

const deleteAttachment = async ({ attachmentId, url }) => {
    if (!attachmentId || !url) {
        throw new Error('Attachment ID and URL are required for deletion.');
    }
    try {
        const filename = url ? url.split('/').pop() : null;

        await ky.delete(`/api/files?filename=${filename}&id=${attachmentId}`, {
            timeout: 30000, // 30 seconds timeout
        });
    } catch (error) {
        console.error('Error in deleteAttachment API call:', error);
        throw new Error('Failed to delete attachment from the server.');
    }
};

export const useRenameAttachment = (condoId) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: renameAttachment,
        onError: (error) => {
            console.error('Error renaming attachment:', error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['files', condoId],
                refetchType: 'all',
            });
        },
    });
};

export const useDeleteAttachment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteAttachment,
        onError: (error) => {
            console.error('Error deleting attachment:', error);
        },
        onSuccess: (_, variables) => {
            const condoId = variables.condoId;

            queryClient.invalidateQueries({
                queryKey: ['files', condoId],
                refetchType: 'all',
            });
        },
    });
};

// Backward compatible aliases
export const useTasksAttachments = useAttachments;
export const useDeleteTaskAttachment = useDeleteAttachment;
