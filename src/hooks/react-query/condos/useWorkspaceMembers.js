import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';
import ky from 'ky';

const api = ky.create({ prefixUrl: '/api' });

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
    const memberIds = members.map((member) => member.id).filter((id) => id != null);

    // Fetch profiles for the corresponding user IDs
    const { data: profiles, error: profilesError } =
        userIds.length > 0
            ? await supabaseClient
                  .from('profiles')
                  .select('user_id, email, avatar, name, profile_updated_at:updated_at')
                  .in('user_id', userIds)
            : { data: [], error: null };

    if (profilesError) {
        console.log(profilesError);
        throw new Error('Failed to fetch profiles');
    }

    const { data: unitMemberships, error: unitMembershipsError } =
        memberIds.length > 0
            ? await supabaseClient
                  .from('unit_members')
                  .select('condo_member_id, unit_id')
                  .in('condo_member_id', memberIds)
            : { data: [], error: null };

    if (unitMembershipsError) {
        throw new Error('Failed to fetch unit memberships');
    }

    const unitIdsByMemberId = new Map();
    for (const membership of unitMemberships || []) {
        const memberId = membership?.condo_member_id;
        const unitId = membership?.unit_id;
        if (memberId == null || unitId == null) continue;
        const current = unitIdsByMemberId.get(memberId) || [];
        current.push(unitId);
        unitIdsByMemberId.set(memberId, current);
    }

    // Merge condo members with their corresponding profile emails
    return members.map((member) => {
        const correspondingProfile = profiles.find((profile) => profile.user_id === member.user_id);

        return {
            ...member, // This keeps the original 'updated_at' from condo_members
            avatar: correspondingProfile?.avatar,
            email: correspondingProfile?.email || '',
            name: correspondingProfile?.name,
            profile_updated_at: correspondingProfile?.profile_updated_at,
            unit_ids: unitIdsByMemberId.get(member.id) || [],
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
    email,
    invite_email,
    role,
    condo_id,
    workspace_id,
    unit_ids,
}) => {
    const condoId = condo_id || workspace_id;
    const memberEmail = email || invite_email;
    if (!memberEmail || !role || !condoId) {
        throw new Error('Missing required fields');
    }
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Missing session');
    }

    const res = await api
        .post('team/invitations', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            json: {
                condo_id: condoId,
                email: memberEmail,
                role,
                unit_ids: Array.isArray(unit_ids) ? unit_ids : [],
            },
        })
        .json();

    if (!res?.success) {
        throw new Error(res?.error || 'Failed to add member');
    }

    return res?.data;
};

// Hook to create a new member
export const useAddWorkspaceMember = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: addWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: ['workspaceMembers', condoId] });
        },
    });
};

// Function to resend invite (force update)
const updateWorkspaceMember = async ({ id, role, unit_ids, condo_id, workspace_id }) => {
    const condoId = condo_id || workspace_id;
    if (!id || !condoId) {
        throw new Error('Missing required fields');
    }

    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Missing session');
    }

    const res = await api
        .patch('team/members', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            json: {
                id,
                condo_id: condoId,
                role,
                unit_ids: Array.isArray(unit_ids) ? unit_ids : undefined,
            },
        })
        .json();

    if (!res?.success) {
        throw new Error(res?.error || 'Failed to update member');
    }

    return res?.data;
};

// Hook to create a new member
export const useUpdateWorkspaceMember = (currentWorkspace) => {
    const queryClient = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useMutation({
        mutationFn: updateWorkspaceMember,
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: ['workspaceMembers', condoId] });
        },
    });
};

// Function to delete an api key
const deleteWorkspaceMember = async ({ id, condo_id, workspace_id }) => {
    const condoId = condo_id || workspace_id;
    if (!id || !condoId) {
        throw new Error('Member ID and condo ID are required');
    }

    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Missing session');
    }

    const res = await api
        .delete('team/members', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            json: { id, condo_id: condoId },
        })
        .json();

    if (!res?.success) {
        throw new Error(res?.error || 'Failed to delete member');
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
            queryClient.invalidateQueries({ queryKey: ['workspaceMembers', condoId] });
        },
    });
};
