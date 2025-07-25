import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/supabase.js';

export const useTaskSubscriptions = (workspace_id) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!workspace_id) return;

        // Define a function to handle real-time changes
        const handleChanges = (payload) => {
            console.log('Real-time change received!', payload);

            // Invalidate the main queries to trigger a refetch
            // This is the simplest approach. See section 3 for a better UX.
            queryClient.invalidateQueries({ queryKey: ['tasks', workspace_id] });
            queryClient.invalidateQueries({ queryKey: ['backlogTasks', workspace_id] });
        };

        // Set up the subscription
        const channel = supabaseClient
            .channel(`public:tasks:workspace_id=eq.${workspace_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'tasks',
                    filter: `workspace_id=eq.${workspace_id}`, // **CRITICAL FOR PERFORMANCE**
                },
                handleChanges,
            )
            .subscribe();

        // Cleanup function to remove the channel subscription when the component unmounts
        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [workspace_id, queryClient]);
};
