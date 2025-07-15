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
import useCurrentWorkspace from '../../../../hooks/useCurrentWorkspace.js';
import { useUser } from '../../../../hooks/react-query/user/useUser.js';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ky from 'ky';

const AsanaTaskDetails = ({ task_id, external_data }) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

    // Extract task information from external_data
    const taskName = external_data?.name;
    const taskNotes = external_data?.notes;
    const taskCompleted = external_data?.completed;
    const taskDueOn = external_data?.due_on;
    const taskAssignee = external_data?.assignee;
    const taskProjects = external_data?.projects || [];
    const taskTags = external_data?.tags || [];
    const taskCustomFields = external_data?.custom_fields || [];
    const taskPermalinkUrl = external_data?.permalink_url;

    // Handle task completion toggle
    const handleToggleCompletion = async () => {
        if (!external_data?.gid) return;

        setIsUpdating(true);
        try {
            // Call API to update task completion status in Asana
            await ky.put(`/api/asana/tasks/${external_data.gid}`, {
                json: {
                    completed: !taskCompleted,
                    user_id: user?.id,
                    workspace_id: currentWorkspace?.workspace_id,
                },
            });

            toast.success(`Task marked as ${!taskCompleted ? 'completed' : 'incomplete'}`);

            // Invalidate queries to refresh the task data
            await queryClient.invalidateQueries({
                queryKey: ['tasks', currentWorkspace?.workspace_id],
            });
        } catch (error) {
            console.error('Error updating task completion:', error);
            toast.error('Failed to update task completion');
        } finally {
            setIsUpdating(false);
        }
    };

    // Format due date
    const formatDueDate = (dateString) => {
        if (!dateString) return null;
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return dateString;
        }
    };

    return (
        <>
            {/* --- Completion Status Section --- */}
            <div className="flex flex-col gap-1">
                <label className="text-sm">Status</label>
                <div>
                    <Button
                        size="sm"
                        variant="flat"
                        className="font-medium"
                        color={taskCompleted ? 'success' : 'default'}
                        onPress={handleToggleCompletion}
                        isLoading={isUpdating}
                    >
                        {taskCompleted ? 'Completed' : 'Incomplete'}
                    </Button>
                </div>
            </div>

            {/* --- Due Date Section --- */}
            {taskDueOn && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Due Date</label>
                    <Chip color="default" variant="light">
                        {formatDueDate(taskDueOn)}
                    </Chip>
                </div>
            )}

            {/* --- Projects Section --- */}
            {taskProjects.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Projects</label>
                    <div className="flex flex-wrap gap-1">
                        {taskProjects.map((project) => (
                            <Chip key={project.gid} size="sm" color="primary" variant="flat">
                                {project.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Tags Section --- */}
            {taskTags.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Tags</label>
                    <div className="flex flex-wrap gap-1">
                        {taskTags.map((tag) => (
                            <Chip key={tag.gid} size="sm" color="secondary" variant="flat">
                                {tag.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Assignee Section --- */}
            {taskAssignee && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Assignee</label>
                    <div className="flex flex-wrap gap-1">
                        <User
                            name={taskAssignee.name}
                            avatarProps={{
                                src: taskAssignee.photo?.image_128x128,
                                size: 'sm',
                                className: 'w-6 h-6 text-tiny',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* --- Custom Fields Section --- */}
            {taskCustomFields.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Custom Fields</label>
                    <div className="space-y-1">
                        {taskCustomFields.map((field) => (
                            <div key={field.gid} className="flex items-center gap-2">
                                <span className="text-sm font-medium">{field.name}:</span>
                                <Chip size="sm" variant="light">
                                    {field.display_value || field.text_value || field.number_value || 'N/A'}
                                </Chip>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- External Link Section --- */}
            {taskPermalinkUrl && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">View in Asana</label>
                    <Button
                        size="sm"
                        variant="light"
                        color="primary"
                        onPress={() => window.open(taskPermalinkUrl, '_blank')}
                    >
                        Open in Asana
                    </Button>
                </div>
            )}
        </>
    );
};

export default AsanaTaskDetails;