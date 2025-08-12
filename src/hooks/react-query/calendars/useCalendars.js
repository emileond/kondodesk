import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase.js';
import { useUser } from '../user/useUser';
import useCurrentWorkspace from '../../useCurrentWorkspace.js';

/**
 * Fetches the user's calendars (both internal and from integrations).
 *
 * This hook retrieves all calendars associated with the current user and workspace.
 * It automatically refetches when the user or workspace changes.
 */
export const useCalendars = () => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const userId = user?.id;
    const workspaceId = currentWorkspace?.workspace_id;

    return useQuery({
        // The query key uniquely identifies this data.
        // It includes userId and workspaceId so it refetches if they change.
        queryKey: ['calendars', userId, workspaceId],

        // The query function to fetch the data.
        queryFn: async () => {
            if (!userId || !workspaceId) return [];

            const { data, error } = await supabaseClient
                .from('calendars')
                .select('*')
                .eq('user_id', userId)
                .eq('workspace_id', workspaceId);

            if (error) {
                console.error('Error fetching calendars:', error);
                throw new Error('Failed to fetch calendars');
            }

            return data || [];
        },

        // This ensures the query does not run until the user and workspace are loaded.
        enabled: !!userId && !!workspaceId,
    });
};

/**
 * Fetches events within a specific date range for the user.
 *
 * This hook is designed to be used by calendar views (month, week, day) to
 * efficiently fetch only the events needed for the current display.
 */
export const useEvents = (dateRange) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const userId = user?.id;
    const workspaceId = currentWorkspace?.workspace_id;

    return useQuery({
        // The query key includes the dateRange so it refetches when the range changes.
        queryKey: ['events', userId, workspaceId, dateRange],

        queryFn: async () => {
            if (!userId || !workspaceId || !dateRange?.start || !dateRange?.end) {
                return [];
            }

            const { data, error } = await supabaseClient
                .from('events')
                .select('*')
                .eq('user_id', userId)
                .eq('workspace_id', workspaceId)
                // Fetch events where the start_time is within the given date range.
                // This covers events that start during the period.
                .gte('start_time', dateRange.start)
                .lte('start_time', dateRange.end);

            if (error) {
                console.error('Error fetching events:', error);
                throw new Error('Failed to fetch events');
            }

            return data || [];
        },

        // The query will only run if all required parameters are available.
        enabled: !!userId && !!workspaceId && !!dateRange?.start && !!dateRange?.end,
    });
};
