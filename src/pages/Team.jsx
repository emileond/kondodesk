import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import {
    Button,
    Input,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Select,
    SelectItem,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Alert,
} from '@heroui/react';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import {
    useWorkspaceMembers,
    useAddWorkspaceMember,
    useUpdateWorkspaceMember,
} from '../hooks/react-query/condos/useWorkspaceMembers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import MemberCard from '../components/team/MemberCard';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useState } from 'react';

function TeamPage() {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: workspaceMembers } = useWorkspaceMembers(currentWorkspace);
    const { mutateAsync: addWorkspaceMember, isPending } = useAddWorkspaceMember(currentWorkspace);
    const { mutateAsync: updateWorkspaceMember } = useUpdateWorkspaceMember(currentWorkspace);
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
    const [editMember, setEditMember] = useState();

    const teamMembersCount =
        workspaceMembers?.filter(
            (member) =>
                member.role === 'admin' || member.role === 'member' || member.role === 'owner',
        ).length || 0;

    const guestsCount = workspaceMembers?.filter((member) => member.role === 'guest').length || 0;

    const isTeamLimitReached = teamMembersCount >= currentWorkspace?.team_seats;
    const isGuestLimitReached = guestsCount >= currentWorkspace?.guest_seats;

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm();

    const selectedRole = watch('role');

    const onSubmit = async (data) => {
        if (editMember) {
            await updateWorkspaceMember(
                {
                    id: editMember.id,
                    role: data.role,
                    workspace_id: editMember.workspace_id,
                },
                {
                    onSuccess: () => {
                        toast.success('Team member updated');
                    },
                    onError: (error) => {
                        toast.error(error.message);
                    },
                },
            );
        } else {
            // Check if email is already invited
            const isDuplicate = workspaceMembers?.some(
                (member) => member.invite_email === data.email || member.email === data.email,
            );
            if (isDuplicate) {
                toast.error('This user is already invited');
            } else {
                await addWorkspaceMember(
                    {
                        invite_email: data.email,
                        role: data.role,
                        workspace_id: currentWorkspace.workspace_id,
                        invited_by: user.email,
                    },
                    {
                        onSuccess: () => {
                            toast.success('Team member invited');
                        },
                        onError: (error) => {
                            toast.error(error.message);
                        },
                    },
                );
            }
        }
        setEditMember(null);
        onClose();
        reset();
    };

    const handleAddMember = () => {
        reset();
        setEditMember(null);
        onOpen();
    };

    const handleEditMember = (member) => {
        setValue('email', member.email);
        setEditMember(member);
        onOpen();
    };

    const columns = [
        { name: 'Name', uid: 'name' },
        { name: 'Role', uid: 'role' },
        { name: 'Status', uid: 'status' },
        { name: 'Actions', uid: 'actions' },
    ];

    return (
        <AppLayout>
            <PageLayout
                title="Team"
                maxW="2xl"
                primaryAction="Invite team member"
                description="Invite team members to your workspace"
                onClick={handleAddMember}
            >
                <div className="flex flex-col gap-3 mb-12">
                    <Table aria-label="Example table with custom cells">
                        <TableHeader columns={columns}>
                            {(column) => (
                                <TableColumn
                                    key={column.uid}
                                    align={column.uid === 'actions' ? 'center' : 'start'}
                                >
                                    {column.name}
                                </TableColumn>
                            )}
                        </TableHeader>
                        <TableBody items={workspaceMembers || []}>
                            {(member) => (
                                <TableRow
                                    key={member.id}
                                    className="border-b last:border-b-0 border-default-300"
                                >
                                    {(columnKey) => (
                                        <TableCell>
                                            <MemberCard
                                                key={member.id}
                                                member={member}
                                                columnKey={columnKey}
                                                onEditMember={(m) => handleEditMember(m)}
                                            />
                                        </TableCell>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="xl">
                    <ModalContent>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <ModalHeader>
                                {editMember ? 'Edit team member' : 'Invite team member'}
                            </ModalHeader>
                            <ModalBody>
                                {isTeamLimitReached && !editMember && selectedRole !== 'guest' && (
                                    <Alert
                                        title="Team limit reached"
                                        description="You have reached your team seat limit. Upgrade your plan to invite more members."
                                        color="danger"
                                        icon="exclamation-circle"
                                    />
                                )}
                                {isGuestLimitReached && !editMember && selectedRole === 'guest' && (
                                    <Alert
                                        title="Guest limit reached"
                                        description="You have reached your guests limit. Upgrade your plan to invite more guests."
                                        color="danger"
                                        icon="exclamation-circle"
                                    />
                                )}
                                <p>
                                    {editMember
                                        ? 'Update user role'
                                        : 'Invite a new member to your workspace'}
                                </p>
                                <div className="flex gap-3">
                                    <Input
                                        {...register('email', { required: true })}
                                        label="Email"
                                        type="email"
                                        autoComplete="off"
                                        isInvalid={errors.email}
                                        isDisabled={editMember}
                                        errorMessage="Email is required"
                                        className="basis-2/3 grow"
                                    />
                                    <Select
                                        {...register('role', { required: true })}
                                        label="Role"
                                        className="basis-1/3"
                                        defaultSelectedKeys={
                                            editMember ? [editMember.role] : ['member']
                                        }
                                    >
                                        <SelectItem key="admin">Admin</SelectItem>
                                        <SelectItem key="member">Member</SelectItem>
                                        <SelectItem key="guest">Guest</SelectItem>
                                    </Select>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose} isDisabled={isPending}>
                                    Cancel
                                </Button>
                                <Button color="primary" type="submit" isLoading={isPending}>
                                    {editMember ? 'Update' : 'Invite'}
                                </Button>
                            </ModalFooter>
                        </form>
                    </ModalContent>
                </Modal>
            </PageLayout>
        </AppLayout>
    );
}

export default TeamPage;
