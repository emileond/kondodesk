import {
    Button,
    Chip,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Tooltip,
    useDisclosure,
    User,
} from '@heroui/react';
import { RiEditLine, RiDeleteBin6Line, RiMailSendLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import {
    useDeleteWorkspaceMember,
    useUpdateWorkspaceMember,
} from '../../hooks/react-query/condos/useWorkspaceMembers.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { useCallback } from 'react';
import BoringAvatar from 'boring-avatars';

function MemberCard({ member, onEditMember, columnKey }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const { onOpen, isOpen, onOpenChange, onClose } = useDisclosure();
    const { mutateAsync: deleteWorkspaceMember, isPending: isDeleting } =
        useDeleteWorkspaceMember(currentWorkspace);
    const { mutateAsync: updateWorkspaceMember, isPending: isUpdating } =
        useUpdateWorkspaceMember(currentWorkspace);

    const handleUpdate = async (role, isResendEmail) => {
        await updateWorkspaceMember(
            { id: member.id, role: isResendEmail ? member.role : role },
            {
                onSuccess: () => {
                    toast.success(isResendEmail ? 'Invitation sent' : 'Member updated');
                },
                onError: (error) => {
                    toast.error(error.message);
                },
            },
        );
        // close modal
    };

    const handleDelete = async () => {
        await deleteWorkspaceMember(
            { id: member.id },
            {
                onSuccess: () => {
                    toast('Member removed');
                },
                onError: (error) => {
                    toast.error(error.message);
                },
            },
        );
        onClose();
    };

    const handleOnEdit = () => {
        onEditMember(member);
    };

    const roleColorMap = {
        owner: 'text-primary',
        admin: 'text-default-600',
        member: 'text-default-600',
    };

    const avatarUrl = member?.avatar ? `${member?.avatar}/w=60` : null;

    const renderCell = useCallback(
        (member, columnKey) => {
            const cellValue = member[columnKey];

            switch (columnKey) {
                case 'name':
                    return avatarUrl ? (
                        <User
                            className="align-middle"
                            name={member?.name || member?.email.split('@')[0]}
                            description={member?.email}
                            avatarProps={{
                                src: avatarUrl,
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-start gap-2">
                            <BoringAvatar
                                name={member?.name || member?.email}
                                size={40}
                                variant="beam"
                                colors={['#fbbf24', '#735587', '#5bc0be', '#6366f1']}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm">
                                    {member?.name || member?.email.split('@')[0]}
                                </span>
                                <span className="text-default-700 text-xs">{member?.email}</span>
                            </div>
                        </div>
                    );
                case 'role':
                    return (
                        <div className="flex flex-col">
                            <Chip
                                className={`capitalize ${roleColorMap[cellValue]}`}
                                size="sm"
                                variant="light"
                                // startContent={roleIconMap[cellValue]}
                            >
                                {cellValue}
                            </Chip>
                        </div>
                    );
                case 'status':
                    return (
                        <Chip
                            className="capitalize"
                            color={cellValue === 'active' ? 'success' : 'primary'}
                            size="sm"
                            variant="flat"
                        >
                            {cellValue}
                        </Chip>
                    );
                case 'actions':
                    return (
                        <div
                            className={`flex items-center justify-end gap-1 ${member.role === 'owner' && 'hidden'}`}
                        >
                            {member.status === 'pending' && (
                                <Tooltip content="Resend invite">
                                    <Button
                                        variant="light"
                                        size="md"
                                        isIconOnly
                                        isDisabled={
                                            new Date(member.updated_at).getTime() >
                                            Date.now() - 24 * 60 * 60 * 1000
                                        }
                                        onPress={() => handleUpdate(member.email, true)}
                                        isLoading={isUpdating}
                                    >
                                        <RiMailSendLine className="text-default-600 text-lg" />
                                    </Button>
                                </Tooltip>
                            )}
                            <Tooltip content="Edit user">
                                <Button
                                    variant="light"
                                    size="sm"
                                    isIconOnly
                                    onPress={handleOnEdit}
                                    isDisabled={member.role === 'owner'}
                                >
                                    <RiEditLine className="text-default-600 text-lg" />
                                </Button>
                            </Tooltip>
                            <Tooltip content="Delete user">
                                <Button
                                    color="danger"
                                    variant="light"
                                    size="md"
                                    isIconOnly
                                    onPress={onOpen}
                                    isDisabled={member.role === 'owner'}
                                >
                                    <RiDeleteBin6Line className="text-lg" />
                                </Button>
                            </Tooltip>
                        </div>
                    );
                default:
                    return cellValue;
            }
        },
        [onEditMember, isUpdating, handleUpdate, handleOnEdit, onOpen],
    );

    return (
        <>
            {renderCell(member, columnKey)}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalHeader>Remove user</ModalHeader>
                    <ModalBody>
                        <p>
                            Are you sure you want to remove
                            <span className="font-bold"> {member.name || member.email}</span> from
                            your workspace?
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="default"
                            variant="light"
                            isDisabled={isDeleting}
                            onPress={onClose}
                        >
                            Close
                        </Button>
                        <Button color="danger" isLoading={isDeleting} onPress={handleDelete}>
                            Yes, remove
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export default MemberCard;
