import {
    Button,
    Card,
    CardBody,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    useDisclosure,
} from '@heroui/react';
import { RiCalendar2Line, RiMoreLine } from 'react-icons/ri';
import { formatDate } from '../../utils/dateUtils.js';
import toast from 'react-hot-toast';
import { useDeleteReflectSession } from '../../hooks/react-query/reflect-sessions/useReflectSessions.js';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import { useNavigate } from 'react-router-dom';
import ReflectSessionStatus from '../../components/common/ReflectSessionStatus.jsx';

const ReflectSessionCard = ({ session }) => {
    const navigate = useNavigate();
    const { data: user } = useUser();
    const { mutateAsync: deleteReflectSession } = useDeleteReflectSession(user?.id);
    const { isOpen: isMenuOpen, onOpenChange: onMenuOpenChange } = useDisclosure();
    const {
        isOpen: isDeleteModalOpen,
        onOpen: onDeleteModalOpen,
        onClose: onDeleteModalClose,
    } = useDisclosure();

    const handleDelete = async () => {
        try {
            await deleteReflectSession({ session_id: session.id });
            onDeleteModalClose();
            toast('Session deleted');
        } catch (error) {
            toast.error('Failed to delete session');
            console.error('Error deleting session:', error);
        }
    };

    const handleAction = (key) => {
        switch (key) {
            case 'delete':
                onDeleteModalOpen();
                break;
            default:
                null;
        }
    };

    return (
        <>
            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
                <ModalContent>
                    <ModalHeader>Delete Task</ModalHeader>
                    <ModalBody>
                        <p>
                            Are you sure you want to delete this session? This action cannot be
                            undone.
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
            <Card
                key={session?.id}
                isPressable
                onPress={() => navigate(`/reflect/session/${session.id}`)}
            >
                <CardBody>
                    <div className="flex items-center justify-between">
                        <span className="font-medium">{session?.name || 'Reflect Session'}</span>
                        <Chip variant="light" startContent={<RiCalendar2Line fontSize="1rem" />}>
                            {formatDate(session.start_date, {
                                dateStyle: 'short',
                            })}{' '}
                            -{' '}
                            {formatDate(session.end_date, {
                                dateStyle: 'short',
                            })}
                        </Chip>
                        <Chip variant="light">{session?.projects?.length} projects</Chip>
                        <ReflectSessionStatus status={session?.status} />
                        <Dropdown isOpen={isMenuOpen} onOpenChange={onMenuOpenChange}>
                            <DropdownTrigger>
                                <div
                                    onClick={onMenuOpenChange}
                                    className={`p-2 hover:bg-default-200 rounded-lg`}
                                >
                                    <RiMoreLine fontSize="1.2rem" />
                                </div>
                            </DropdownTrigger>
                            <DropdownMenu onAction={(key) => handleAction(key)}>
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
                </CardBody>
            </Card>
        </>
    );
};

export default ReflectSessionCard;
