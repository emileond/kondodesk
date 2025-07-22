import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    DropdownSection,
    Spinner,
} from '@heroui/react';
import { RiArrowDownSLine, RiCheckLine, RiTimeLine } from 'react-icons/ri';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../../../hooks/react-query/user/useUser.js';
import useCurrentWorkspace from '../../../../../hooks/useCurrentWorkspace.js';

const GoogleTasksDetails = ({ task_id, external_data }) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

    // Extract Google Tasks data
    const taskListTitle = external_data?.taskListTitle || 'Unknown List';
    const dueDate = external_data?.due ? new Date(external_data.due).toLocaleDateString() : null;
    const status = external_data?.status || 'needsAction';
    const notes = external_data?.notes;
    const updated = external_data?.updated ? new Date(external_data.updated).toLocaleDateString() : null;

    // Handle task completion toggle
    const handleStatusToggle = async () => {
        if (!external_data?.id) return;

        setIsUpdating(true);
        try {
            // This would require an API endpoint to update Google Tasks
            // For now, we'll just show a toast
            toast.success('Google Tasks status updates are not yet implemented');
            
            // In a full implementation, you would:
            // 1. Call Google Tasks API to update the task status
            // 2. Update the local task in the database
            // 3. Invalidate relevant queries
            
        } catch (error) {
            toast.error('Failed to update task status');
        } finally {
            setIsUpdating(false);
        }
    };

    if (!external_data) {
        return <Spinner label="Loading Google Tasks details..." />;
    }

    return (
        <>
            {/* Task List Section */}
            <div className="flex flex-col gap-1">
                <label className="text-sm">Task List</label>
                <Chip color="primary" variant="flat">
                    {taskListTitle}
                </Chip>
            </div>

            {/* Status Section */}
            <div className="flex flex-col gap-1">
                <label className="text-sm">Status</label>
                <div>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size="sm"
                                variant="flat"
                                className="font-medium"
                                startContent={
                                    status === 'completed' ? (
                                        <RiCheckLine className="text-success" />
                                    ) : (
                                        <RiTimeLine className="text-warning" />
                                    )
                                }
                                endContent={<RiArrowDownSLine fontSize="1rem" />}
                                isLoading={isUpdating}
                                color={status === 'completed' ? 'success' : 'warning'}
                            >
                                {status === 'completed' ? 'Completed' : 'Needs Action'}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Google Tasks Status">
                            <DropdownSection title="Change status:">
                                <DropdownItem
                                    key="needsAction"
                                    onPress={handleStatusToggle}
                                    startContent={<RiTimeLine />}
                                >
                                    Needs Action
                                </DropdownItem>
                                <DropdownItem
                                    key="completed"
                                    onPress={handleStatusToggle}
                                    startContent={<RiCheckLine />}
                                >
                                    Completed
                                </DropdownItem>
                            </DropdownSection>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            </div>

            {/* Due Date Section */}
            {dueDate && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Due Date</label>
                    <Chip color="default" variant="light" startContent={<RiTimeLine />}>
                        {dueDate}
                    </Chip>
                </div>
            )}

            {/* Notes Section */}
            {notes && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Notes</label>
                    <div className="text-sm text-default-600 bg-default-100 p-3 rounded-lg">
                        {notes}
                    </div>
                </div>
            )}

            {/* Last Updated Section */}
            {updated && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Last Updated</label>
                    <Chip size="sm" variant="light">
                        {updated}
                    </Chip>
                </div>
            )}

            {/* Task ID for debugging */}
            {external_data?.id && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-default-400">Task ID</label>
                    <Chip size="sm" variant="light" className="font-mono text-xs">
                        {external_data.id}
                    </Chip>
                </div>
            )}
        </>
    );
};

export default GoogleTasksDetails;