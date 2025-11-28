import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// Fetch all worskpaces for a user
const fetchWorkspaces = async (user) => {
    const { data, error } = await supabaseClient
        .from('condo_members')
        .select(
            `
      condo_id,
      role,
      condos!condo_members_condo_id_fkey (
        name
      )
    `,
        )
        .eq('user_id', user?.id)
        .eq('status', 'active');

    if (error) {
        console.error('Error fetching condos:', error);
        throw error;
    }

    const transformedData = data.map((item) => ({
        condo_id: item.condo_id,
        role: item.role,
        name: item.condo?.name,
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
