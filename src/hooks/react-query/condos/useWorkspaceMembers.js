import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch email lists for a specific team
const fetchWorkspaceMembers = async (condo_id) => {
    // Fetch workspace members first
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

    // Merge workspace members with their corresponding profile emails
    return members.map((member) => {
        const correspondingProfile = profiles.find((profile) => profile.user_id === member.user_id);

        return {
            ...member, // This keeps the original 'updated_at' from workspace_members
            avatar: correspondingProfile?.avatar,
            email: correspondingProfile?.email || member?.invite_email,
            name: correspondingProfile?.name,
            profile_updated_at: correspondingProfile?.profile_updated_at,
        };
    });
};

// Hook to fetch all workspace members
export const useWorkspaceMembers = (currentWorkspace) => {
    return useQuery({
        queryKey: ['workspaceMembers', currentWorkspace?.workspace_id],
        queryFn: () => fetchWorkspaceMembers(currentWorkspace?.workspace_id),
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled: !!currentWorkspace?.workspace_id, // Only fetch if teamId is provided
    });
};

// Function to add a new member
const addWorkspaceMember = async ({ invite_email, role, workspace_id, invited_by }) => {
    if (!invite_email || !role || !workspace_id || !invited_by) {
        throw new Error('Missing required fields');
    }
    const { error: rpcError } = await supabaseClient.rpc('check_seat_limit', {
        p_workspace_id: workspace_id,
        p_role: role,
    });

    if (rpcError) {
        throw new Error(rpcError.message);
    }

    const { error } = await supabaseClient.from('workspace_members').insert([
        {
            invite_email,
            role,
            workspace_id,
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

    return useMutation({
        mutationFn: addWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries(['workspaceMembers', currentWorkspace?.workspace_id]);
        },
    });
};

// Function to resend invite (force update)
const updateWorkspaceMember = async ({ id, role, workspace_id }) => {
    const { error } = await supabaseClient
        .from('workspace_members')
        .update([
            {
                role,
                workspace_id,
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

    return useMutation({
        mutationFn: updateWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries(['workspaceMembers', currentWorkspace?.workspace_id]);
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

    return useMutation({
        mutationFn: deleteWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch the email lists query for the team
            queryClient.invalidateQueries(['workspaceMembers', currentWorkspace?.workspace_id]);
        },
    });
};
