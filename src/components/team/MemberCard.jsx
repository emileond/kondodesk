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
import { RiEditLine, RiDeleteBin6Line } from 'react-icons/ri';
import toast from 'react-hot-toast';
import {
    useDeleteWorkspaceMember,
} from '../../hooks/react-query/condos/useWorkspaceMembers.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import BoringAvatar from 'boring-avatars';

const ROLE_COLOR_MAP = {
    owner: 'text-primary',
    admin: 'text-default-600',
    member: 'text-default-600',
    resident: 'text-default-600',
};

function MemberCard({ member, onEditMember, columnKey, canEdit = true, canDelete = true }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    const { onOpen, isOpen, onOpenChange, onClose } = useDisclosure();
    const { mutateAsync: deleteWorkspaceMember, isPending: isDeleting } =
        useDeleteWorkspaceMember(currentWorkspace);

    const handleDelete = async () => {
        await deleteWorkspaceMember(
            { id: member.id, condo_id: condoId },
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

    const avatarUrl = member?.avatar ? `${member?.avatar}/w=60` : null;

    const renderCell = (member, columnKey) => {
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
                            className={`capitalize ${ROLE_COLOR_MAP[cellValue]}`}
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
                        {canEdit && (
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
                        )}
                        {canDelete && (
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
                        )}
                    </div>
                );
            default:
                return cellValue;
        }
    };

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
