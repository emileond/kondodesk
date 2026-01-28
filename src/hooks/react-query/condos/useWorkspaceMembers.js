import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch email lists for a specific condo
const fetchWorkspaceMembers = async (condo_id) => {
    // Fetch condo members first
    const { data: members, error: membersError } = await supabaseClient
        .from('condo_members')
        .select('*')
        .eq('condo_id', condo_id)
        .in('status', ['active', 'pending']);

    if (membersError) {
        throw new Error('Failed to fetch workspace members');
    }

    const userIds = members
        .filter((member) => member.user_id !== null)
        .map((member) => member.user_id);

    // Fetch profiles for the corresponding user IDs
    const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('user_id, email, avatar, name, profile_updated_at:updated_at')
        .in('user_id', userIds);

    if (profilesError) {
        console.log(profilesError);
        throw new Error('Failed to fetch profiles');
    }

    // Merge condo members with their corresponding profile emails
    return members.map((member) => {
        const correspondingProfile = profiles.find((profile) => profile.user_id === member.user_id);

        return {
            ...member, // This keeps the original 'updated_at' from condo_members
            avatar: correspondingProfile?.avatar,
            email: correspondingProfile?.email || member?.invite_email,
            name: correspondingProfile?.name,
            profile_updated_at: correspondingProfile?.profile_updated_at,
        };
    });
};

// Hook to fetch all condo members
export const useWorkspaceMembers = (currentWorkspace) => {
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    return useQuery({
        queryKey: ['workspaceMembers', condoId],
        queryFn: () => fetchWorkspaceMembers(condoId),
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled: !!condoId, // Only fetch if teamId is provided
    });
};

// Function to add a new member
const addWorkspaceMember = async ({
    invite_email,
    role,
    condo_id,
    workspace_id,
    invited_by,
    unit_ids,
}) => {
    const condoId = condo_id || workspace_id;
    if (!invite_email || !role || !condoId || !invited_by) {
        throw new Error('Missing required fields');
    }
    const { error: rpcError } = await supabaseClient.rpc('check_seat_limit', {
        p_workspace_id: condoId,
        p_role: role,
    });

    if (rpcError) {
        throw new Error(rpcError.message);
    }

    const { error } = await supabaseClient.from('condo_members').insert([
        {
            invite_email,
            role,
            condo_id: condoId,
            unit_ids: Array.isArray(unit_ids) && unit_ids.length > 0 ? unit_ids : null,
            status: 'pending',
            invited_by: invited_by,
            updated_at: new Date(),
        },
    ]);

    if (error) {
        console.error('Error adding workspace member:', error);
        throw new Error(error.message);
    }
};

// Hook to create a new member
export const useAddWorkspaceMember = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: addWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries(['workspaceMembers', condoId]);
        },
    });
};

// Function to resend invite (force update)
const updateWorkspaceMember = async ({ id, role }) => {
    const { error } = await supabaseClient
        .from('condo_members')
        .update([
            {
                role,
                updated_at: new Date(),
            },
        ])
        .eq('id', id);

    if (error) {
        console.error('Error updating workspace member:', error);
        throw new Error(error.message);
    }
};

// Hook to create a new member
export const useUpdateWorkspaceMember = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: updateWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries(['workspaceMembers', condoId]);
        },
    });
};

// Function to delete an api key
const deleteWorkspaceMember = async ({ id }) => {
    if (!id) {
        throw new Error('Member ID is required');
    }
    // Prevent owner deletion
    const { data: member } = await supabaseClient
        .from('condo_members')
        .select('role')
        .eq('id', id)
        .single();

    if (member?.role === 'owner') {
        throw new Error('Cannot delete workspace owner');
    }

    const { error } = await supabaseClient.from('condo_members').delete().eq('id', id);

    if (error) {
        console.error('Error deleting:', error);
        throw new Error('Failed to delete member');
    }
};

// Hook to delete an api key
export const useDeleteWorkspaceMember = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: deleteWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch the email lists query for the team
            queryClient.invalidateQueries(['workspaceMembers', condoId]);
        },
    });
};
