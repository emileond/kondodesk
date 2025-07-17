import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    DropdownSection,
} from '@heroui/react';
import { RiArrowDownSLine } from 'react-icons/ri';
import useCurrentWorkspace from '../../../../../hooks/useCurrentWorkspace.js';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../../../hooks/react-query/user/useUser.js';
import { useMutation } from '@tanstack/react-query';
import ky from 'ky';

const MicrosoftToDoTaskDetails = ({ task_id, external_data }) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const queryClient = useQueryClient();

    // Mutation for updating task status
    const { mutateAsync: updateTaskStatus, isLoading: isUpdating } = useMutation({
        mutationFn: async ({ taskId, listId, status }) => {
            await ky.post('/api/microsoft/todo/status', {
                json: {
                    task_id,
                    taskId,
                    listId,
                    status,
                    user_id: user?.id,
                    workspace_id: currentWorkspace?.workspace_id,
                },
            });
        },
    });

    // Extract task data
    const currentStatus = external_data?.status || 'notStarted';
    const listName = external_data?.listName || 'Unknown List';
    const listId = external_data?.listId;
    const taskId = external_data?.id;
    const completedDateTime = external_data?.completedDateTime;
    const importance = external_data?.importance || 'normal';

    // Status options for Microsoft To Do
    const statusOptions = [
        { id: 'notStarted', name: 'Not Started', color: 'default' },
        { id: 'completed', name: 'Completed', color: 'success' },
    ];

    const getStatusColor = (status) => {
        const statusOption = statusOptions.find((option) => option.id === status);
        return statusOption?.color || 'default';
    };

    const getStatusName = (status) => {
        const statusOption = statusOptions.find((option) => option.id === status);
        return statusOption?.name || status;
    };

    const getImportanceColor = (importance) => {
        switch (importance) {
            case 'high':
                return 'danger';
            case 'normal':
                return 'primary';
            case 'low':
                return 'default';
            default:
                return 'default';
        }
    };

    // Handle status change
    const handleStatusChange = async (newStatus) => {
        if (!taskId || !listId) {
            toast.error('Missing task or list information');
            return;
        }

        try {
            await updateTaskStatus({
                taskId,
                listId,
                status: newStatus,
            });

            toast.success('Microsoft To Do task status updated');

            // Invalidate queries to refresh the task data
            await queryClient.invalidateQueries({
                queryKey: ['tasks', currentWorkspace?.workspace_id],
            });
        } catch (error) {
            toast.error(error.message || 'Failed to update Microsoft To Do task status');
        }
    };

    return (
        <>
            {/* --- Status Section --- */}
            <div className="flex flex-col gap-1">
                <label className="text-sm">Status</label>
                <div>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size="sm"
                                variant="flat"
                                color={getStatusColor(currentStatus)}
                                className="font-medium"
                                endContent={<RiArrowDownSLine fontSize="1rem" />}
                                isLoading={isUpdating}
                            >
                                {getStatusName(currentStatus)}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Microsoft To Do Status Options">
                            <DropdownSection title="Change status to:">
                                {statusOptions
                                    .filter((option) => option.id !== currentStatus)
                                    .map((option) => (
                                        <DropdownItem
                                            key={option.id}
                                            onPress={() => handleStatusChange(option.id)}
                                        >
                                            {option.name}
                                        </DropdownItem>
                                    ))}
                            </DropdownSection>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            </div>

            {/* --- Importance Section --- */}
            {importance && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Importance</label>
                    <Chip color={getImportanceColor(importance)} variant="flat" size="sm">
                        {importance.charAt(0).toUpperCase() + importance.slice(1)}
                    </Chip>
                </div>
            )}

            {/* --- List Section --- */}
            {listName && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">List</label>
                    <Chip color="default" variant="light" size="sm">
                        {listName}
                    </Chip>
                </div>
            )}

            {/* --- Completion Date Section --- */}
            {completedDateTime && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Completed</label>
                    <div className="text-sm text-default-600">
                        {new Date(completedDateTime.dateTime).toLocaleDateString()}
                    </div>
                </div>
            )}
        </>
    );
};

export default MicrosoftToDoTaskDetails;
