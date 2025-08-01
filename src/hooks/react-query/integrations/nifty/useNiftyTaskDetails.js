import { useQuery } from '@tanstack/react-query';
import ky from 'ky';

const fetchNiftyTaskDetails = async ({ taskId, workspace_id }) => {
    if (!taskId || !workspace_id) {
        throw new Error('Task ID and Workspace ID are required.');
    }

    const response = await ky
        .get(`/api/nifty/task`, {
            searchParams: {
                taskId,
                workspace_id,
            },
        })
        .json();

    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch Nifty task details');
    }

    return response;
};

export const useNiftyTaskDetails = (taskId, workspace_id) => {
    return useQuery({
        // Unique key for this query
        queryKey: ['nifty', 'task-details', taskId],
        // The function that will be executed to fetch the data
        queryFn: () => fetchNiftyTaskDetails({ taskId, workspace_id }),
        // Only run this query if both taskId and workspace_id are available
        enabled: !!taskId && !!workspace_id,
        // Refetch data when the component mounts, similar to the Trello example
        refetchOnMount: true,
    });
};
