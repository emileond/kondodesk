import { Button, useDisclosure, Pagination, Spinner, Input } from '@heroui/react';
import { RiAddLine, RiArchiveStackLine, RiSearchLine } from 'react-icons/ri';
import {
    useBacklogTasks,
    useFuzzySearchTasks,
    useUpdateMultipleTasks,
} from '../../hooks/react-query/tasks/useTasks.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import DraggableList from './DraggableList.jsx';
import NewTaskModal from './NewTaskModal.jsx';
import TasksFilters from './TasksFilters.jsx';
import { useEffect, useState, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import debounce from '../../utils/debounceUtils.js';
import dayjs from 'dayjs';
import EmptyState from '../EmptyState.jsx';

// Memoized panel content component to prevent unnecessary re-renders
// eslint-disable-next-line react/display-name
const BacklogPanelContent = memo(({ currentWorkspace, isOpen, onOpenChange }) => {
    const [page, setPage] = useState(1);
    const pageSize = 20; // Number of tasks to show per page
    const { register, watch } = useForm();
    const searchTerm = watch('searchTerm', '');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(true);

    // Filter state
    const [filters, setFilters] = useState({
        project_id: null,
        milestone_id: null,
        tags: null,
        integration_source: null,
        priority: null,
    });

    // Create a debounced function to update search term
    const debouncedSetSearchTerm = useCallback(
        debounce((value) => {
            setDebouncedSearchTerm(value);
        }, 500),
        [],
    );

    // Update debounced search term when search term changes
    useEffect(() => {
        debouncedSetSearchTerm(searchTerm);
    }, [searchTerm, debouncedSetSearchTerm]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [filters]);

    // Use the hook with pagination parameters and filters for backlog tasks
    const {
        data: tasksData,
        refetch,
        isLoading,
    } = useBacklogTasks(currentWorkspace, page, pageSize, filters);

    // Use the hook for fuzzy search with debounced search term
    const { data: searchData, isLoading: isSearching } = useFuzzySearchTasks(
        currentWorkspace,
        debouncedSearchTerm,
        pageSize,
        { status_filter: 'pending', date_filter_type: 'is_null' },
    );

    const { mutateAsync: updateMultipleTasks } = useUpdateMultipleTasks(currentWorkspace);

    // Determine which tasks to display based on debounced search term
    const isSearchActive = debouncedSearchTerm && debouncedSearchTerm.trim() !== '';
    const tasks = isSearchActive ? searchData?.data || [] : tasksData?.data || [];

    const [totalTasks, setTotalTasks] = useState(tasksData?.count);
    const totalPages = Math.ceil(totalTasks / pageSize);

    const handleDragEnd = async (e, startCol) => {
        const endCol = e.parent.el.id; // YYYY-MM-DD string

        const itemIndex = e?.draggedNode?.data.index;
        const itemId = e?.draggedNode?.data?.value?.id;
        const itemDate = e?.draggedNode?.data?.value?.date
            ? dayjs(e?.draggedNode?.data?.value?.date)?.tz(dayjs.tz.guess(), true)?.toISOString()
            : null;

        const columnItems = e.values; // The items in the target column
        const newDate = e.parent.el.id; // The target list (backlog or a date)

        // If the target list is valid (a date column)
        let updatedDate = null;
        if (dayjs(newDate).isValid()) {
            updatedDate = dayjs(newDate).startOf('day').tz(dayjs.tz.guess(), true).toISOString();
        }

        // if item date and target date are the same, return
        if (itemDate === updatedDate) return;

        let tasksToUpdate = null;

        // Prepare the tasks to be updated
        if (updatedDate) {
            // only update all items in the column if is a day col
            tasksToUpdate = columnItems.map((item, index) => ({
                taskId: item.id,
                updates: {
                    date: updatedDate,
                    order: index,
                },
            }));
        } else {
            // otherwise is going to the backlog, so only update the dragged item
            tasksToUpdate = [
                {
                    taskId: itemId,
                    updates: {
                        date: null,
                        order: itemIndex,
                    },
                },
            ];
        }

        // Call the bulk update function
        try {
            await updateMultipleTasks({
                tasks: tasksToUpdate,
                startCol: startCol || 'backlog',
                endCol,
            });
        } catch (error) {
            console.error('Error updating tasks:', error);
        }
    };

    useEffect(() => {
        if (tasksData?.count && !isSearchActive) {
            setTotalTasks(tasksData?.count);
        }
    }, [tasksData, isSearchActive]);

    useEffect(() => {
        if (!isOpen) {
            refetch();
        }
    }, [isOpen, refetch]);

    return (
        <>
            <NewTaskModal isOpen={isOpen} onOpenChange={onOpenChange} defaultDate={null} />
            <div className="bg-content2 border border-default rounded-xl p-4 flex flex-col h-full">
                <div className="flex items-center gap-2 w-full py-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-default-700 pb-1">
                        <RiArchiveStackLine fontSize="1.2rem" /> Backlog
                    </h3>
                    <div>
                        <Button
                            size="sm"
                            color="primary"
                            variant="light"
                            startContent={<RiAddLine />}
                            onPress={() => onOpenChange(true)}
                        >
                            Add task
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-1 mb-3">
                    <Input
                        size="sm"
                        color="primary"
                        variant="bordered"
                        placeholder="Search..."
                        startContent={<RiSearchLine />}
                        {...register('searchTerm')}
                        autoComplete="off"
                    />

                    <TasksFilters
                        showFilters={showFilters}
                        onShowFiltersChange={setShowFilters}
                        onFiltersChange={setFilters}
                        initialFilters={filters}
                    />
                </div>

                {(isSearchActive && isSearching) || (!isSearchActive && isLoading) ? (
                    <div className="flex grow items-center justify-center">
                        <Spinner size="lg" />
                    </div>
                ) : tasks.length > 0 ? (
                    <DraggableList
                        id="backlog"
                        items={tasks}
                        group="tasks"
                        smallCards
                        onDragEnd={handleDragEnd}
                    />
                ) : (
                    <EmptyState
                        title="No tasks found."
                        description="We couldn't find any tasks matching this criteria. Try adjusting your filters"
                    />
                )}

                {!isSearchActive && !!totalPages && (
                    <div className="flex w-full justify-center mt-4">
                        <Pagination
                            size="sm"
                            variant="light"
                            showControls
                            page={page}
                            total={totalPages}
                            onChange={(newPage) => setPage(newPage)}
                        />
                    </div>
                )}
            </div>
        </>
    );
});

function BacklogPanel({ isBacklogCollapsed }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const { isOpen, onOpenChange } = useDisclosure();

    // Use CSS for width/size transition, but conditionally render content
    return (
        <div
            className={`${isBacklogCollapsed ? 'basis-0 w-0' : 'basis-1/3'} shadow-2xl rounded-xl transition-all duration-200 overflow-hidden`}
            style={{
                opacity: isBacklogCollapsed ? 0 : 1,
                transition: 'opacity 200ms ease, flex-basis 200ms ease, width 200ms ease',
            }}
        >
            {!isBacklogCollapsed && (
                <BacklogPanelContent
                    currentWorkspace={currentWorkspace}
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                />
            )}
        </div>
    );
}

export default BacklogPanel;
