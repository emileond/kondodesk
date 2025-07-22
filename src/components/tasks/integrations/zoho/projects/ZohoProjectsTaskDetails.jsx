import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    DropdownSection,
    User,
    Spinner,
} from '@heroui/react';
import { RiArrowDownSLine } from 'react-icons/ri';
import useCurrentWorkspace from '../../../../../hooks/useCurrentWorkspace.js';
import { useUser } from '../../../../../hooks/react-query/user/useUser.js';
import { useState } from 'react';
import toast from 'react-hot-toast';
import ky from 'ky';

const ZohoProjectsTaskDetails = ({ task_id, external_data }) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [statusesLoaded, setStatusesLoaded] = useState(false);

    // Extract project ID from external data or host
    const projectId = external_data?.project_id || external_data?.project?.id;
    
    // Current task data
    const currentStatus = external_data?.status;
    const currentPriority = external_data?.priority;
    const currentAssignee = external_data?.assignee || external_data?.assigned_to;
    const currentCreator = external_data?.creator || external_data?.created_by;
    const currentDueDate = external_data?.due_date;

    // Load available statuses when dropdown is opened
    const loadStatuses = async () => {
        if (statusesLoaded || !projectId) return;

        try {
            const response = await ky.get('/api/zoho/projects/transitions', {
                searchParams: {
                    taskId: external_data?.id,
                    projectId: projectId,
                    user_id: user?.id,
                    workspace_id: currentWorkspace?.workspace_id,
                },
            }).json();

            if (response.success) {
                setAvailableStatuses(response.statuses || []);
                setStatusesLoaded(true);
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    };

    // Handle status transition
    const handleStatusChange = async (statusId) => {
        if (!projectId) {
            toast.error('Project information not available');
            return;
        }

        setIsTransitioning(true);
        try {
            await ky.post('/api/zoho/projects/transitions', {
                json: {
                    task_id,
                    taskId: external_data?.id,
                    projectId: projectId,
                    statusId: statusId,
                    user_id: user?.id,
                    workspace_id: currentWorkspace?.workspace_id,
                },
            });

            toast.success('Zoho Projects task status updated');
            // Note: In a real implementation, you might want to refetch the task data here
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.message || 'Failed to update task status');
        } finally {
            setIsTransitioning(false);
        }
    };

    if (!external_data) {
        return <Spinner label="Loading Zoho Projects details..." />;
    }

    return (
        <>
            {/* --- Status Section --- */}
            {currentStatus && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Status</label>
                    <div>
                        <Dropdown onOpenChange={(isOpen) => isOpen && loadStatuses()}>
                            <DropdownTrigger>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    className="font-medium"
                                    endContent={<RiArrowDownSLine fontSize="1rem" />}
                                    isLoading={isTransitioning}
                                >
                                    {currentStatus.name || currentStatus}
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Zoho Projects Status Changes">
                                <DropdownSection title="Change to:">
                                    {availableStatuses.map((status) => (
                                        <DropdownItem
                                            key={status.id}
                                            onPress={() => handleStatusChange(status.id)}
                                        >
                                            {status.name}
                                        </DropdownItem>
                                    ))}
                                </DropdownSection>
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                </div>
            )}

            {/* --- Priority Section --- */}
            {currentPriority && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Priority</label>
                    <Chip
                        color={
                            currentPriority.toLowerCase() === 'high' ? 'danger' :
                            currentPriority.toLowerCase() === 'medium' ? 'warning' :
                            'default'
                        }
                        variant="light"
                    >
                        {currentPriority.name || currentPriority}
                    </Chip>
                </div>
            )}

            {/* --- Due Date Section --- */}
            {currentDueDate && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Due Date</label>
                    <Chip color="default" variant="light">
                        {new Date(currentDueDate).toLocaleDateString()}
                    </Chip>
                </div>
            )}

            {/* --- Assignee Section --- */}
            {currentAssignee && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Assignee</label>
                    <div className="flex flex-wrap gap-1">
                        <User
                            name={currentAssignee.name || currentAssignee.display_name}
                            description={currentAssignee.email}
                            avatarProps={{
                                src: currentAssignee.avatar_url,
                                size: 'sm',
                                className: 'w-6 h-6 text-tiny',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* --- Creator Section --- */}
            {currentCreator && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Creator</label>
                    <div className="flex flex-wrap gap-1">
                        <User
                            name={currentCreator.name || currentCreator.display_name}
                            description={currentCreator.email}
                            avatarProps={{
                                src: currentCreator.avatar_url,
                                size: 'sm',
                                className: 'w-6 h-6 text-tiny',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* --- Project Information --- */}
            {external_data?.project && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Project</label>
                    <Chip color="primary" variant="light">
                        {external_data.project.name}
                    </Chip>
                </div>
            )}
        </>
    );
};

export default ZohoProjectsTaskDetails;