import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSection,
    DropdownTrigger,
    Link,
    User,
} from '@heroui/react';
import { RiArrowDownSLine, RiTaskLine } from 'react-icons/ri';
import { colorContrast } from '../../../../utils/colorContrast.js';
import ky from 'ky';
import toast from 'react-hot-toast';
import { useUser } from '../../../../hooks/react-query/user/useUser.js';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const NiftyTaskDetails = ({ external_data }) => {
    const { data: user } = useUser();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);

    const STATES = [
        { key: 'pending', label: 'Open' },
        { key: 'completed', label: 'Complete' },
    ];

    const options = STATES.filter((s) => s.key !== external_data?.status);

    const handleStatusChange = async (newState) => {
        setIsLoading(true);
        try {
            await ky.patch('/api/nifty/task', {
                json: {
                    external_id: external_data?.id,
                    state: newState,
                    user_id: user?.id,
                },
            });
            toast.success('Nifty task updated');
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
            console.error('Error updating Nifty task status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {external_data?.status && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Status</label>
                    <div className="flex gap-3 items-center">
                        <Dropdown>
                            <DropdownTrigger>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    className="font-medium"
                                    endContent={<RiArrowDownSLine fontSize="1rem" />}
                                    isLoading={isLoading}
                                >
                                    {external_data?.status === 'completed' ? 'Complete' : 'Open'}
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
            <div className="flex flex-col gap-1 items-start">
                <label className="text-sm">Assignees</label>
                {external_data?.assignees?.map((member) => (
                    <User
                        key={member?.id}
                        name={member?.name || member?.email}
                        avatarProps={{
                            src: member?.avatar_url,
                            size: 'sm',
                            className: 'w-6 h-6 text-tiny',
                        }}
                    />
                ))}
            </div>
            {!!external_data?.labels?.length && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Labels</label>
                    <div className="flex flex-wrap gap-1">
                        {external_data?.labels?.map((label) => (
                            <Chip
                                key={label.id}
                                size="sm"
                                style={{
                                    background: `${label?.color}cc`,
                                    color: colorContrast(label?.color?.replace('#', ''), 'y'),
                                }}
                            >
                                {label?.name}
                            </Chip>
                        ))}
                    </div>
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
                        startContent={<RiTaskLine fontSize=".9rem" />}
                    >
                        <Link
                            className="text-sm text-default-700"
                            isExternal
                            href={`https://nifty.pm/projects/${external_data?.project?.id}`}
                        >
                            {external_data?.project?.name}
                        </Link>
                    </Chip>
                </div>
            )}
        </>
    );
};

export default NiftyTaskDetails;