import { useMemo, useState, useCallback, memo, useEffect } from 'react'; // 1. Import useEffect
import { useDisclosure, User, Chip, Avatar } from '@heroui/react';
import { createColumnHelper } from '@tanstack/react-table';
import dayjs from 'dayjs';
import DataGrid from '../common/DataGrid';
import EntityChip from '../common/EntityChip';
import TaskDetailModalWrapper from './TaskDetailModalWrapper';
import { useWorkspaceMembers } from '../../hooks/react-query/teams/useWorkspaceMembers';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import BoringAvatar from 'boring-avatars';

// Memoized cell components (No changes needed here)
const EmptyCell = memo(() => <span className="text-default-400">—</span>);
EmptyCell.displayName = 'EmptyCell';

const DateCell = memo(({ date, isCompleted }) => {
    if (!date) return <EmptyCell />;
    const taskDate = dayjs(date);
    const today = dayjs().startOf('day');
    const isOverdue = taskDate.isBefore(today);

    return (
        <span className={isOverdue && !isCompleted ? 'text-danger' : ''}>
            {Intl.DateTimeFormat(navigator.language, {
                dateStyle: 'medium',
            }).format(new Date(date))}
        </span>
    );
});
DateCell.displayName = 'DateCell';

const TaskNameCell = memo(({ name, isCompleted }) => (
    <span className={`${isCompleted ? 'line-through text-default-400' : ''}`}>{name}</span>
));
TaskNameCell.displayName = 'TaskNameCell';

const AssigneeCell = memo(({ assigneeId, members }) => {
    if (!assigneeId || !members) return <EmptyCell />;

    const assignee = members.find(member => member.user_id === assigneeId);
    if (!assignee) return <EmptyCell />;

    return (
        <div className="flex items-center gap-2">
            {assignee.avatar ? (
                <Avatar
                    src={`${assignee.avatar}/w=24?t=${assignee.updated_at}`}
                    className="w-6 h-6"
                />
            ) : (
                <BoringAvatar
                    name={assignee.name || assignee.email}
                    size={24}
                    variant="beam"
                    colors={['#fbbf24', '#735587', '#5bc0be', '#6366f1']}
                />
            )}
            <span className="text-sm">{assignee.name || assignee.email}</span>
        </div>
    );
});
AssigneeCell.displayName = 'AssigneeCell';

// Main TableView component
const TableView = ({ items, pageKey = 'global' }) => {
    // 2. Accept a pageKey prop
    const [taskStatus, setTaskStatus] = useState({});
    const [selectedTask, setSelectedTask] = useState(null);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 15,
    });
    const {
        isOpen: isDetailModalOpen,
        onOpen: onDetailModalOpen,
        onClose: onDetailModalClose,
    } = useDisclosure();

    // Get workspace members for assignee display
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: members } = useWorkspaceMembers(currentWorkspace);

    // 3. Create a dynamic storage key for sorting preferences
    const sortingStorageKey = useMemo(() => `taskTableSort_${pageKey}`, [pageKey]);

    // 4. Initialize sorting state from localStorage
    const [sorting, setSorting] = useState(() => {
        // Ensure localStorage is available (for SSR safety)
        if (typeof window === 'undefined') {
            return [{ id: 'status', desc: false }];
        }
        try {
            const savedSort = window.localStorage.getItem(sortingStorageKey);
            // If a saved state exists, parse and return it
            if (savedSort) {
                return JSON.parse(savedSort);
            }
        } catch (error) {
            console.error('Failed to parse sorting state from localStorage:', error);
            // Fallback to default if parsing fails
        }
        // Default sorting state if nothing is saved
        return [{ id: 'status', desc: false }];
    });

    // 5. Use an effect to save the sorting state whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(sortingStorageKey, JSON.stringify(sorting));
        }
    }, [sorting, sortingStorageKey]); // Re-run this effect when sorting or the key changes

    // Memoized row click handler
    const handleRowClick = useCallback(
        (task) => {
            setSelectedTask(task);
            onDetailModalOpen();
        },
        [onDetailModalOpen],
    );

    // Memoized modal close handler
    const handleModalOpenChange = useCallback(
        (isOpen) => {
            if (!isOpen) {
                onDetailModalClose();
            }
        },
        [onDetailModalClose],
    );

    // Memoized column helper
    const columnHelper = useMemo(() => createColumnHelper(), []);

    // Memoized columns (No changes needed here)
    const columns = useMemo(
        () => [
            columnHelper.accessor('name', {
                header: 'Task',
                cell: ({ row }) => {
                    const task = row.original;
                    const status =
                        taskStatus[task.id] !== undefined
                            ? taskStatus[task.id]
                                ? 'completed'
                                : 'pending'
                            : task.status;
                    const isCompleted = status === 'completed';

                    return <TaskNameCell name={task.name} isCompleted={isCompleted} />;
                },
            }),
            columnHelper.accessor('status', {
                header: 'Status',
                cell: ({ row }) => {
                    const task = row.original;
                    const status =
                        taskStatus[task.id] !== undefined
                            ? taskStatus[task.id]
                                ? 'completed'
                                : 'pending'
                            : task.status;

                    let chipColor;
                    let statusText;

                    if (status === 'completed') {
                        chipColor = 'success';
                        statusText = 'Completed';
                    } else if (status === 'in progress') {
                        chipColor = 'primary';
                        statusText = 'In Progress';
                    } else {
                        chipColor = 'default';
                        statusText = 'Pending';
                    }

                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Chip size="sm" variant="flat" color={chipColor}>
                                {statusText}
                            </Chip>
                        </div>
                    );
                },
                size: 120,
            }),
            columnHelper.accessor('assignee', {
                header: 'Assignee',
                cell: ({ getValue }) => {
                    const assigneeId = getValue();
                    return <AssigneeCell assigneeId={assigneeId} members={members} />;
                },
                size: 180,
            }),
            columnHelper.accessor('date', {
                header: 'Date',
                cell: ({ getValue, row }) => {
                    const task = row.original;
                    const status =
                        taskStatus[task.id] !== undefined
                            ? taskStatus[task.id]
                                ? 'completed'
                                : 'pending'
                            : task.status;
                    const isCompleted = status === 'completed';

                    return <DateCell date={getValue()} isCompleted={isCompleted} />;
                },
            }),
            columnHelper.accessor('project_id', {
                header: 'Project',
                cell: ({ getValue }) => {
                    const projectId = getValue();
                    if (!projectId) return <EmptyCell />;
                    return (
                        <EntityChip type="project" entityId={projectId} size="sm" variant="light" />
                    );
                },
            }),
            columnHelper.accessor('milestone_id', {
                header: 'Milestone',
                cell: ({ getValue }) => {
                    const milestoneId = getValue();
                    if (!milestoneId) return <EmptyCell />;
                    return (
                        <EntityChip
                            type="milestone"
                            entityId={milestoneId}
                            size="sm"
                            variant="light"
                        />
                    );
                },
            }),
            columnHelper.accessor('tags', {
                header: 'Tags',
                cell: ({ row }) => {
                    const task = row.original;
                    const tags = task.tags || task.tag_id;

                    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
                        return <EmptyCell />;
                    }

                    return <EntityChip type="tag" entityId={tags} size="sm" variant="light" />;
                },
            }),
            columnHelper.accessor('priority', {
                header: 'Priority',
                cell: ({ getValue }) => {
                    const priority = getValue();
                    if (priority === null || priority === undefined) {
                        return <EmptyCell />;
                    }

                    return (
                        <EntityChip type="priority" entityId={priority} size="sm" variant="light" />
                    );
                },
            }),
        ],
        [columnHelper, taskStatus, members],
    );

    // Handle pagination state changes
    const handlePaginationChange = useCallback((updatedPagination) => {
        setPagination(updatedPagination);
    }, []);

    // The sorting handler now just updates the state. The `useEffect` hook will handle persistence.
    const handleSortingChange = useCallback((updatedSorting) => {
        setSorting(updatedSorting);
    }, []);

    // Memoized options for DataGrid
    const gridOptions = useMemo(
        () => ({
            // Remove initialState, as the `state` prop now fully controls it
            state: {
                sorting: sorting,
                pagination: pagination,
            },
            onSortingChange: handleSortingChange,
            onPaginationChange: handlePaginationChange,
            manualPagination: false,
        }),
        [sorting, pagination, handleSortingChange, handlePaginationChange],
    );

    return (
        <div className="border-1 border-content3 rounded-xl bg-content1 mb-16">
            {selectedTask && (
                <TaskDetailModalWrapper
                    isOpen={isDetailModalOpen}
                    onOpenChange={handleModalOpenChange}
                    task={selectedTask}
                />
            )}
            <DataGrid
                data={items || []}
                columns={columns}
                options={gridOptions}
                onRowClick={handleRowClick}
                pageSize={pagination.pageSize}
            />
        </div>
    );
};

TableView.displayName = 'TableView';

export default TableView;
