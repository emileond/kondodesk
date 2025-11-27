import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Progress,
    useDisclosure,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
} from '@heroui/react';
import { RiFlag2Line, RiMoreLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import {
    useDeleteMilestone,
    useUpdateMilestone,
    useTaskCountByMilestone,
} from '../../hooks/react-query/milestones/useMilestones.js';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const MilestoneCard = ({ milestone }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: taskCount } = useTaskCountByMilestone(milestone?.id);
    const { mutateAsync: updateMilestone } = useUpdateMilestone(currentWorkspace);
    const { mutateAsync: deleteMilestone } = useDeleteMilestone(currentWorkspace);
    const { isOpen: isMenuOpen, onOpenChange: onMenuOpenChange } = useDisclosure();
    const {
        isOpen: isEditModalOpen,
        onOpen: onEditModalOpen,
        onClose: onEditModalClose,
    } = useDisclosure();
    const {
        isOpen: isDeleteModalOpen,
        onOpen: onDeleteModalOpen,
        onClose: onDeleteModalClose,
    } = useDisclosure();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: {
            name: milestone.name,
        },
    });

    const handleAction = (key) => {
        switch (key) {
            case 'edit':
                onEditModalOpen();
                break;
            case 'delete':
                onDeleteModalOpen();
                break;
            default:
                null;
        }
    };

    const handleEdit = async (data) => {
        try {
            await updateMilestone({
                milestoneId: milestone.id,
                updates: {
                    name: data.name,
                },
            });
            toast.success('Milestone updated');
            onEditModalClose();
        } catch (error) {
            toast.error(error.message || 'Failed to update milestone');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMilestone({ milestoneId: milestone.id });
            toast('Milestone deleted');
            onDeleteModalClose();
        } catch (error) {
            toast.error(error.message || 'Failed to delete milestone');
        }
    };

    const totalCount = taskCount?.total || 0;
    const completedCount = taskCount?.completed || 0;
    const pendingCount = taskCount?.pending || 0;
    const completedPercentage =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <>
            <Card key={milestone.id} shadow="none" className="w-full border border-default-200">
                <CardHeader className="pb-0">
                    <div className="w-full flex justify-between">
                        <div className="flex items-center gap-2">
                            <RiFlag2Line fontSize="1rem" className="text-primary" />
                            <Link to={`/milestones/${milestone.id}/tasks`} className="hover:text-primary-600">
                                <span>{milestone.name}</span>
                            </Link>
                        </div>
                        <Dropdown isOpen={isMenuOpen} onOpenChange={onMenuOpenChange}>
                            <DropdownTrigger>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    isIconOnly
                                    onPress={onMenuOpenChange}
                                    startContent={<RiMoreLine fontSize="1.2rem" />}
                                />
                            </DropdownTrigger>
                            <DropdownMenu onAction={(key) => handleAction(key)}>
                                <DropdownItem key="edit">Edit</DropdownItem>
                                <DropdownItem
                                    key="delete"
                                    className="text-danger"
                                    variant="flat"
                                    color="danger"
                                >
                                    Delete
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                </CardHeader>
                <CardBody>
                    <Progress
                        aria-label="Milestone progress"
                        size="sm"
                        color="success"
                        maxValue={totalCount}
                        value={completedCount}
                    />
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-3 py-1 items-center">
                            <Chip size="sm" variant="light" className="text-default-500">
                                {completedPercentage}%
                            </Chip>
                            <Chip size="sm" variant="light" className="text-default-500">
                                {pendingCount} pending
                            </Chip>
                            <Chip size="sm" variant="light" className="text-default-500">
                                {completedCount} completed
                            </Chip>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={onEditModalClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(handleEdit)}>
                        <ModalHeader>Edit Milestone</ModalHeader>
                        <ModalBody>
                            <Input
                                label="Milestone name"
                                {...register('name', { required: true })}
                                isInvalid={!!errors.name}
                                errorMessage="Milestone name is required"
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={onEditModalClose}>
                                Cancel
                            </Button>
                            <Button color="primary" type="submit">
                                Update
                            </Button>
                        </ModalFooter>
                    </form>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
                <ModalContent>
                    <ModalHeader>Delete Milestone</ModalHeader>
                    <ModalBody>
                        <p>
                            Are you sure you want to delete "{milestone.name}"? This action cannot
                            be undone.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onDeleteModalClose}>
                            Cancel
                        </Button>
                        <Button color="danger" onPress={handleDelete}>
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default MilestoneCard;
