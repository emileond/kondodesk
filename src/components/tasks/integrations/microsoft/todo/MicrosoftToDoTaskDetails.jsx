import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    DropdownSection,
} from '@heroui/react';
import { RiArrowDownSLine, RiPriceTag3Line } from 'react-icons/ri';
import useCurrentWorkspace from '../../../../../hooks/useCurrentWorkspace.js';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../../../hooks/react-query/user/useUser.js';
import { useMutation } from '@tanstack/react-query';
import ky from 'ky';
import { colorContrast } from '../../../../../utils/colorContrast.js';

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
    const taskId = external_data?.id;
    const completedDateTime = external_data?.completedDateTime;
    const dueDateTime = external_data?.dueDateTime;
    const importance = external_data?.importance || 'normal';
    const categories = external_data?.categories || null;

    // Status options for Microsoft To Do
    const statusOptions = [
        { id: 'notStarted', name: 'Not Started', color: 'default' },
        { id: 'completed', name: 'Completed', color: 'success' },
    ];

    const getImportanceColor = (importance) => {
        switch (importance) {
            case 'high':
                return 'warning';
            case 'normal':
                return 'default';
            case 'low':
                return 'blue';
            default:
                return 'default';
        }
    };

    const getCategoryColor = (category) => {
        const cat = category.toLowerCase();

        if (cat.includes('blue')) {
            return 'bg-blue-500';
        } else if (cat.includes('green')) {
            return 'bg-success';
        } else if (cat.includes('orange')) {
            return 'bg-warning';
        } else if (cat.includes('purple')) {
            return 'bg-violet-500';
        } else if (cat.includes('red')) {
            return 'bg-danger';
        } else if (cat.includes('yellow')) {
            return 'bg-yellow-500';
        } else {
            return 'bg-default';
        }
    };

    return (
        <>
            {/* --- Importance Section --- */}
            {importance && (
                <div className="flex flex-col gap-1">
                    <Chip
                        className="text-default-600"
                        size="sm"
                        variant="light"
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Importance
                    </Chip>
                    <Chip color={getImportanceColor(importance)} variant="flat" size="sm">
                        {importance.charAt(0).toUpperCase() + importance.slice(1)}
                    </Chip>
                </div>
            )}

            {categories?.length > 0 && (
                <div className="flex flex-col gap-1">
                    <Chip
                        size="sm"
                        color="default"
                        className="text-default-600"
                        variant="light"
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Categories
                    </Chip>
                    <div className="flex flex-wrap gap-1">
                        {categories.map((category) => (
                            <Chip
                                key={category}
                                size="sm"
                                variant="dot"
                                classNames={{
                                    dot: getCategoryColor(category),
                                }}
                            >
                                {category}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Due Date Section --- */}
            {dueDateTime && (
                <div className="flex flex-col gap-1">
                    <Chip
                        size="sm"
                        color="default"
                        className="text-default-600"
                        variant="light"
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Due date
                    </Chip>
                    <div className="text-sm text-default-600">
                        {Intl.DateTimeFormat(navigator.language, {
                            dateStyle: 'medium',
                        }).format(new Date(dueDateTime.dateTime))}
                    </div>
                </div>
            )}

            {/* --- Completion Date Section --- */}
            {completedDateTime && currentStatus === 'completed' && (
                <div className="flex flex-col gap-1">
                    <Chip
                        size="sm"
                        color="default"
                        className="text-default-600"
                        variant="light"
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Completed date
                    </Chip>
                    <div className="text-sm text-default-600">
                        {Intl.DateTimeFormat(navigator.language, {
                            dateStyle: 'medium',
                        }).format(new Date(completedDateTime.dateTime))}
                    </div>
                </div>
            )}
        </>
    );
};

export default MicrosoftToDoTaskDetails;
