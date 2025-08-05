import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSection,
    DropdownTrigger,
    User,
} from '@heroui/react';
import { RiArrowDownSLine, RiBuilding2Line } from 'react-icons/ri';
import { colorContrast } from '../../../../utils/colorContrast.js';
import ky from 'ky';
import toast from 'react-hot-toast';
import { useUser } from '../../../../hooks/react-query/user/useUser.js';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const AworkTaskDetails = ({ external_data }) => {
    const { data: user } = useUser();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);

    const STATUSES = [
        { key: 'new', label: 'New' },
        { key: 'progress', label: 'In Progress' },
        { key: 'review', label: 'Review' },
        { key: 'done', label: 'Done' },
    ];

    const options = STATUSES.filter((s) => s.key !== external_data?.taskStatusType);

    const handleStatusChange = async (newStatus) => {
        setIsLoading(true);
        try {
            await ky.patch('/api/awork/task', {
                json: {
                    external_id: external_data?.id,
                    taskStatusType: newStatus,
                    user_id: user?.id,
                },
            });
            toast.success('Awork task updated');
            await queryClient.cancelQueries({
                queryKey: ['tasks'],
            });

            await queryClient.invalidateQueries({
                queryKey: ['tasks'],
                refetchType: 'all',
            });
            await queryClient.invalidateQueries({
                queryKey: ['backlogTasks'],
                refetchType: 'all',
            });
        } catch (error) {
            toast.error(error.message);
            console.error('Error updating Awork task status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new':
                return 'default';
            case 'progress':
                return 'primary';
            case 'review':
                return 'warning';
            case 'done':
                return 'success';
            default:
                return 'default';
        }
    };

    const getStatusLabel = (status) => {
        const statusObj = STATUSES.find(s => s.key === status);
        return statusObj ? statusObj.label : status;
    };

    return (
        <>
            {external_data?.taskStatusType && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Status</label>
                    <div className="flex gap-3 items-center">
                        <Dropdown>
                            <DropdownTrigger>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color={getStatusColor(external_data?.taskStatusType)}
                                    className="font-medium"
                                    endContent={<RiArrowDownSLine fontSize="1rem" />}
                                    isLoading={isLoading}
                                >
                                    {getStatusLabel(external_data?.taskStatusType)}
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu>
                                <DropdownSection title="Move to:">
                                    {options?.map((opt) => (
                                        <DropdownItem
                                            key={opt.key}
                                            onPress={() => handleStatusChange(opt.key)}
                                        >
                                            {opt.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownSection>
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                </div>
            )}
            
            {external_data?.assignedUser && (
                <div className="flex flex-col gap-1 items-start">
                    <label className="text-sm">Assignee</label>
                    <User
                        name={`${external_data.assignedUser.firstName} ${external_data.assignedUser.lastName}`}
                        description={external_data.assignedUser.email}
                        avatarProps={{
                            src: external_data.assignedUser.icon,
                            size: 'sm',
                            className: 'w-6 h-6 text-tiny',
                        }}
                    />
                </div>
            )}

            {external_data?.project && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Project</label>
                    <Chip
                        color="default"
                        className="text-default-700"
                        size="sm"
                        variant="bordered"
                        startContent={<RiBuilding2Line fontSize=".9rem" />}
                    >
                        <span className="text-sm text-default-700">
                            {external_data.project.name}
                        </span>
                    </Chip>
                </div>
            )}

            {external_data?.tags && external_data.tags.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Tags</label>
                    <div className="flex flex-wrap gap-1">
                        {external_data.tags.map((tag) => (
                            <Chip
                                key={tag.id}
                                size="sm"
                                style={{
                                    background: tag.color ? `${tag.color}33` : '#e4e4e7',
                                    color: tag.color ? colorContrast(tag.color.replace('#', ''), 'y') : '#71717a',
                                }}
                            >
                                {tag.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {external_data?.plannedDuration && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Planned Duration</label>
                    <Chip
                        color="default"
                        className="text-default-700"
                        size="sm"
                        variant="flat"
                    >
                        {Math.round(external_data.plannedDuration / 3600)} hours
                    </Chip>
                </div>
            )}

            {external_data?.priority && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Priority</label>
                    <Chip
                        color={external_data.priority === 'high' ? 'danger' : external_data.priority === 'medium' ? 'warning' : 'default'}
                        className="text-default-700"
                        size="sm"
                        variant="flat"
                    >
                        {external_data.priority.charAt(0).toUpperCase() + external_data.priority.slice(1)}
                    </Chip>
                </div>
            )}
        </>
    );
};

export default AworkTaskDetails;