import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch all worskpaces for a user
const fetchWorkspaces = async (user) => {
    const { data, error } = await supabaseClient
        .from('workspace_members')
        .select(
            `
      workspace_id,
      role,
      workspaces!workspace_members_workspace_id_fkey (
        name, is_ltd, plan, onboarded, subscription_status, trial_ends_at, team_seats, guest_seats
      )
    `,
        )
        .eq('user_id', user?.id)
        .eq('status', 'active');

    if (error) {
        console.error('Error fetching workspaces:', error);
        throw error;
    }

    const transformedData = data.map((item) => ({
        workspace_id: item.workspace_id,
        role: item.role,
        name: item.workspaces?.name,
        is_ltd: item.workspaces?.is_ltd,
        plan: item.workspaces?.plan,
        onboarded: item.workspaces?.onboarded,
        subscription_status: item.workspaces?.subscription_status,
        trial_ends_at: item.workspaces?.trial_ends_at,
        team_seats: item.workspaces?.team_seats,
        guest_seats: item.workspaces?.guest_seats,
    }));

    return transformedData;
};

// Hook to fetch all worskpaces
export const useWorkspaces = (user) => {
    return useQuery({
        queryKey: ['workspaces', user?.id],
        queryFn: () => fetchWorkspaces(user),
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled: !!user,
    });
};
