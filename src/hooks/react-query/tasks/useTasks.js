import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';
import dayjs from 'dayjs';

// Fetch tasks for a specific workspace
const fetchTasks = async ({
    statusList,
    id,
    workspace_id,
    startDate,
    endDate,
    project_id,
    milestone_id,
    tags,
    integration_source,
    priority,
    assignees,
    includeInProgress,
}) => {
    let query = supabaseClient.from('tasks').select('*').eq('workspace_id', workspace_id);
    if (id) {
        query = query.eq('id', id).single(); // Fetch single item
    } else {
        if (includeInProgress && startDate && endDate) {
            // Use an OR query to get tasks scheduled for today OR tasks that are in progress
            query = query.or(
                `and(date.gte.${startDate},date.lte.${endDate}),and(status.eq.in progress,date.not.is.null)`,
            );
        } else {
            if (statusList) {
                query = query.in('status', statusList);
            }
            if (startDate && endDate) {
                query = query.gte('date', startDate).lte('date', endDate);
            } else if (!startDate && endDate) {
                query = query.lte('date', endDate);
            }
        }
        if (project_id) {
            query = query.eq('project_id', project_id);
        }

        if (milestone_id) {
            query = query.eq('milestone_id', milestone_id);
        }

        if (tags && tags.length > 0) {
            query = query.contains('tags', tags);
        }

        if (integration_source) {
            query = query.eq('integration_source', integration_source);
        }

        if (typeof priority === 'number') {
            query = query.eq('priority', priority);
        }

        if (assignees === 'any') {
        } else if (assignees) {
            query = query.in('assignee', assignees);
        } else if (!assignees) {
            query = query.is('assignee', null);
        }

        query = query.order('order');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase error:', error); // Log the actual error
        throw new Error('Failed to fetch tasks');
    }

    return data;
};

// Hook to fetch tasks with optional filters
export const useTasks = (currentWorkspace, filters = {}) => {
    return useQuery({
        queryKey: ['tasks', currentWorkspace?.workspace_id, filters],
        queryFn: () =>
            fetchTasks({
                workspace_id: currentWorkspace?.workspace_id,
                ...filters,
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!currentWorkspace?.workspace_id && Object.keys(filters)?.length > 0,
    });
};

const fetchBacklogTasks = async ({
    workspace_id,
    page = 1,
    pageSize = 20,
    project_id = null,
    milestone_id = null,
    tags = null,
    integration_source = null,
    priority = null,
}) => {
    // First, fetch only the count of tasks
    let countQuery = supabaseClient
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .is('date', null)
        .eq('status', 'pending');

    // Apply additional filters to count query
    if (project_id) {
        countQuery = countQuery.eq('project_id', project_id);
    }

    if (milestone_id) {
        countQuery = countQuery.eq('milestone_id', milestone_id);
    }

    if (tags && tags.length > 0) {
        // For tags, we need to check if the task's tags array contains any of the selected tags
        countQuery = countQuery.contains('tags', tags);
    }

    if (integration_source) {
        countQuery = countQuery.eq('integration_source', integration_source);
    }

    if (priority) {
        countQuery = countQuery.eq('priority', priority);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
        throw new Error('Failed to fetch task count');
    }

    // Calculate range for pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Then fetch the actual tasks data
    let dataQuery = supabaseClient
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspace_id)
        .is('date', null)
        .eq('status', 'pending')
        .order('order')
        .range(from, to);

    // Apply the same filters to data query
    if (project_id) {
        dataQuery = dataQuery.eq('project_id', project_id);
    }

    if (milestone_id) {
        dataQuery = dataQuery.eq('milestone_id', milestone_id);
    }

    if (tags && tags.length > 0) {
        dataQuery = dataQuery.contains('tags', tags);
    }

    if (integration_source) {
        dataQuery = dataQuery.eq('integration_source', integration_source);
    }

    if (priority) {
        dataQuery = dataQuery.eq('priority', priority);
    }

    const { data, error: dataError } = await dataQuery;

    if (dataError) {
        throw new Error('Failed to fetch tasks data');
    }

    return { data, count };
};

// Hook to fetch paginated backlog tasks for a given workspace
export const useBacklogTasks = (currentWorkspace, page = 1, pageSize = 20, filters = {}) => {
    return useQuery({
        queryKey: [
            'backlogTasks',
            currentWorkspace?.workspace_id,
            page,
            pageSize,
            filters.project_id,
            filters.milestone_id,
            filters.tags,
            filters.integration_source,
            filters.priority,
        ],
        queryFn: () =>
            fetchBacklogTasks({
                workspace_id: currentWorkspace?.workspace_id,
                page,
                pageSize,
                project_id: filters.project_id,
                milestone_id: filters.milestone_id,
                tags: filters.tags,
                integration_source: filters.integration_source,
                priority: filters.priority,
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!currentWorkspace?.workspace_id, // Only fetch if workspace_id is provided
    });
};

// Fetch counts per day in the range
async function fetchTaskCounts({ workspace_id, startDate, endDate }) {
    // we cast timestamp → date so we group by calendar date
    const { data, error } = await supabaseClient
        .from('tasks')
        .select(`date`, { head: false, count: 'exact' })
        .eq('workspace_id', workspace_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        console.error(error);
        throw error;
    }

    // data comes back as [{ day: "2025-05-05", count: "4" }, …]
    return data.reduce((acc, { day, count }) => {
        acc[day] = Number(count);
        return acc;
    }, {});
}

export function useTasksCount(currentWorkspace, { startDate, endDate }) {
    return useQuery({
        queryKey: ['tasks-count', currentWorkspace?.workspace_id, startDate, endDate],
        queryFn: () =>
            fetchTaskCounts({
                workspace_id: currentWorkspace.workspace_id,
                startDate,
                endDate,
            }),

        enabled: !!currentWorkspace?.workspace_id && !!startDate && !!endDate,
        staleTime: 1000 * 60 * 5,
    });
}

// Function to create a new task
const createTask = async ({ task }) => {
    const { data, error } = await supabaseClient.from('tasks').insert(task).select().single();

    if (error) {
        throw new Error('Failed to create task');
    }
    return data;
};

// Hook to create a new task
export const useCreateTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createTask,
        onSuccess: (newTask) => {
            // Invalidate all task-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['tasks'],
                refetchType: 'all',
            });
            queryClient.invalidateQueries({
                queryKey: ['backlogTasks'],
                refetchType: 'all',
            });

            // Invalidate the counts for the project and milestone of the new task
            if (newTask.project_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByProject', newTask.project_id],
                });
            }
            if (newTask.milestone_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByMilestone', newTask.milestone_id],
                });
            }
        },
    });
};

// Function to update a task
const updateTask = async ({ taskId, updates }) => {
    // Create a mutable copy of the updates to avoid side effects.
    const finalUpdates = { ...updates };

    // If the date is being set to null (i.e., moving to the backlog)...
    if ('date' in finalUpdates && finalUpdates.date == null) {
        // ...and the status isn't already 'completed', then default it to 'pending'.
        // This prevents overwriting a valid "completed" status while ensuring
        // other statuses like "in progress" are correctly handled.
        if (finalUpdates.status !== 'completed') {
            finalUpdates.status = 'pending';
        }
    }

    // Use the potentially modified 'finalUpdates' object.
    const { data, error } = await supabaseClient
        .from('tasks')
        .update(finalUpdates)
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        console.error('Supabase error:', error);
        throw error;
    }
    return data;
};

// Hook to update a task
export const useUpdateTask = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateTask,
        onMutate: async ({ taskId }) => {
            // Snapshot the task's state before the mutation
            const { data: previousTask } = await supabaseClient
                .from('tasks')
                .select('project_id, milestone_id')
                .eq('id', taskId)
                .single();
            return { previousTask };
        },
        onError: (error) => {
            console.error('Error updating task:', error);
        },
        onSuccess: (updatedTask, variables, context) => {
            // Invalidate all task-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['tasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
            queryClient.invalidateQueries({
                queryKey: ['backlogTasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
            // Reset fuzzy search tasks queries
            queryClient.invalidateQueries({
                queryKey: ['fuzzySearchTasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });

            const previousTask = context.previousTask;

            // Invalidate the count for the task's NEW project and milestone
            if (updatedTask.project_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByProject', updatedTask.project_id],
                });
            }
            if (updatedTask.milestone_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByMilestone', updatedTask.milestone_id],
                });
            }

            // If the project was changed, invalidate the count for the OLD project
            if (previousTask?.project_id && previousTask.project_id !== updatedTask.project_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByProject', previousTask.project_id],
                });
            }

            // If the milestone was changed, invalidate the count for the OLD milestone
            if (
                previousTask?.milestone_id &&
                previousTask.milestone_id !== updatedTask.milestone_id
            ) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByMilestone', previousTask.milestone_id],
                });
            }
        },
    });
};

// Function to update multiple tasks
const updateMultipleTasks = async ({ tasks, startCol, endCol }) => {
    const updates = tasks.map((task) =>
        supabaseClient.from('tasks').update(task.updates).eq('id', task.taskId),
    );

    // Execute all updates concurrently
    const results = await Promise.all(updates);

    // Handle errors if any
    results.forEach((result, index) => {
        if (result.error) {
            console.error(`Failed to update task ${tasks[index].taskId}`, result.error);
        }
    });

    // Return the columns that were affected for targeted invalidation
    return { startCol, endCol };
};

// Hook to update multiple tasks
export const useUpdateMultipleTasks = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateMultipleTasks,
        onError: (error) => {
            console.error('Error updating tasks:', error);
        },
        onSuccess: (result) => {
            const { startCol, endCol } = result;

            // Invalidate only the affected columns
            if (startCol === 'backlog' || endCol === 'backlog') {
                // Invalidate backlog queries if backlog is involved
                queryClient.invalidateQueries({
                    queryKey: ['backlogTasks', currentWorkspace?.workspace_id],
                    refetchType: 'all',
                });
            }

            // Invalidate start column queries if it's a date column
            if (startCol !== 'backlog' && startCol) {
                const startDate = dayjs(startCol).startOf('day').toISOString();
                const endDate = dayjs(startCol).endOf('day').toISOString();

                queryClient.invalidateQueries({
                    queryKey: ['tasks', currentWorkspace?.workspace_id, { startDate, endDate }],
                    refetchType: 'all',
                });
            }

            // Invalidate end column queries if it's a date column and different from start column
            if (endCol !== 'backlog' && endCol && endCol !== startCol) {
                const startDate = dayjs(endCol).startOf('day').toISOString();
                const endDate = dayjs(endCol).endOf('day').toISOString();

                queryClient.invalidateQueries({
                    queryKey: ['tasks', currentWorkspace?.workspace_id, { startDate, endDate }],
                    refetchType: 'all',
                });
            }
        },
    });
};

// Function to delete a task
const deleteTask = async ({ taskId }) => {
    const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);

    if (error) {
        throw new Error('Failed to delete task');
    }
};

// Hook to delete a task
export const useDeleteTask = (currentWorkspace) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId }) => deleteTask({ taskId }),
        onMutate: async ({ taskId }) => {
            // Snapshot the task's state before it's deleted
            const { data: previousTask } = await supabaseClient
                .from('tasks')
                .select('project_id, milestone_id')
                .eq('id', taskId)
                .single();
            return { previousTask };
        },
        onError: (error) => {
            console.error('Error deleting task:', error);
        },
        onSuccess: (data, variables, context) => {
            // Invalidate all task-related queries for the workspace
            queryClient.invalidateQueries({
                queryKey: ['tasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
            queryClient.invalidateQueries({
                queryKey: ['backlogTasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });
            // Reset fuzzy search tasks queries
            queryClient.invalidateQueries({
                queryKey: ['fuzzySearchTasks', currentWorkspace?.workspace_id],
                refetchType: 'all',
            });

            const previousTask = context.previousTask;

            // Invalidate the counts for the project and milestone of the deleted task
            if (previousTask?.project_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByProject', previousTask.project_id],
                });
            }
            if (previousTask?.milestone_id) {
                queryClient.invalidateQueries({
                    queryKey: ['taskCountByMilestone', previousTask.milestone_id],
                });
            }
        },
    });
};

// Function to fuzzy search tasks with flexible filters
const fuzzySearchTasksWithFilters = async ({
    searchText,
    resultLimit = 20,
    filters = {}, // Accept a filters object for more flexibility
}) => {
    // Ensure searchText is valid if it's required for the core search functionality
    if (!searchText || searchText.trim() === '') {
        if (Object.keys(filters).length === 0) {
            // Only return empty if no other filters
            return { data: [] };
        }
    }

    const { data, error } = await supabaseClient.rpc('fuzzy_search_tasks_with_filters', {
        search_text: searchText,
        result_limit: resultLimit,
        // Spread the filters object to pass all the dynamic parameters
        ...filters,
    });

    if (error) {
        console.error('Error searching tasks:', error);
        throw new Error('Failed to search tasks');
    }

    return { data };
};

// Hook to fuzzy search tasks with flexible filters
export const useFuzzySearchTasks = (
    currentWorkspace,
    searchText,
    resultLimit = 20,
    // Combine all optional filters into a single object
    filters = {},
) => {
    const queryKey = [
        'fuzzySearchTasks',
        currentWorkspace?.workspace_id,
        searchText,
        resultLimit,
        JSON.stringify(filters), // Include filters in queryKey
    ];

    // Determine if the query should be enabled.
    // If searchText is mandatory for *any* search, include it.
    // Otherwise, if filters alone can trigger a search, adjust accordingly.
    const isQueryEnabled =
        !!currentWorkspace?.workspace_id &&
        ((!!searchText && searchText.trim() !== '') || Object.keys(filters).length > 0);

    return useQuery({
        queryKey: queryKey,
        queryFn: () =>
            fuzzySearchTasksWithFilters({
                searchText,
                resultLimit,
                filters, // Pass the entire filters object
            }),
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: isQueryEnabled,
        // Keep previous data when query key changes for smoother UX, if desired
        // keepPreviousData: true,
    });
};
