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
    useCondoInvitations,
    useDeleteCondoInvitation,
} from '../hooks/react-query/condos/useWorkspaceMembers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import MemberCard from '../components/team/MemberCard';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useEffect, useMemo, useState } from 'react';
import { RiDeleteBin6Line } from 'react-icons/ri';
import { RiHome4Line } from 'react-icons/ri';
import { RiFileCopyLine } from 'react-icons/ri';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../lib/supabase';
import CreatableSelect from '../components/form/CreatableSelect.jsx';
import { useCreateUnit, useUnitsList } from '../hooks/react-query/units/useUnits.js';

function TeamPage() {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    const { data: workspaceMembers } = useWorkspaceMembers(currentWorkspace);
    const { mutateAsync: addWorkspaceMember, isPending } = useAddWorkspaceMember(currentWorkspace);
    const { mutateAsync: updateWorkspaceMember } = useUpdateWorkspaceMember(currentWorkspace);
    const { mutateAsync: deleteCondoInvitation, isPending: isDeletingInvitation } =
        useDeleteCondoInvitation(currentWorkspace);
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
    const {
        isOpen: isInviteLinkOpen,
        onOpen: onInviteLinkOpen,
        onOpenChange: onInviteLinkOpenChange,
        onClose: onInviteLinkClose,
    } = useDisclosure();
    const [editMember, setEditMember] = useState();
    const [inviteLinkToShare, setInviteLinkToShare] = useState('');
    const [formKey, setFormKey] = useState(0);

    const { data: currentMember } = useQuery({
        queryKey: ['condoMember', condoId, user?.id],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('condo_members')
                .select('role')
                .eq('condo_id', condoId)
                .eq('user_id', user?.id)
                .maybeSingle();
            if (error) throw new Error('Failed to fetch user role');
            return data;
        },
        enabled: !!condoId && !!user?.id,
        staleTime: 1000 * 60 * 5,
    });

    const canManageMembers = ['owner', 'admin'].includes(currentMember?.role);
    const { data: pendingInvitations = [] } = useCondoInvitations(
        currentWorkspace,
        canManageMembers,
    );
    const { data: units = [] } = useUnitsList(currentWorkspace, user, {
        includeAll: true,
    });
    const { mutateAsync: createUnit } = useCreateUnit(currentWorkspace);

    const unitOptions = useMemo(
        () => units.map((unit) => ({ value: unit.id, label: unit.address })),
        [units],
    );
    const unitAddressById = useMemo(
        () => new Map(units.map((unit) => [String(unit.id), unit.address])),
        [units],
    );
    const displayMembers = useMemo(() => {
        return (workspaceMembers || []).map((member) => {
            const unitIds = Array.isArray(member.unit_ids) ? member.unit_ids : [];
            const unitLabel =
                unitIds.length > 0
                    ? unitIds
                          .map((id) => unitAddressById.get(String(id)) || String(id))
                          .join(', ')
                    : '—';
            return { ...member, unit_display: unitLabel };
        });
    }, [workspaceMembers, unitAddressById]);
    const displayInvitations = useMemo(() => {
        return (pendingInvitations || []).map((invite) => {
            const unitIds = Array.isArray(invite.unit_ids) ? invite.unit_ids : [];
            const unitLabel =
                unitIds.length > 0
                    ? unitIds
                          .map((id) => unitAddressById.get(String(id)) || String(id))
                          .join(', ')
                    : '—';
            return {
                ...invite,
                unit_display: unitLabel,
            };
        });
    }, [pendingInvitations, unitAddressById]);

    const teamMembersCount =
        workspaceMembers?.filter(
            (member) => member.role === 'admin' || member.role === 'resident',
        ).length || 0;

    const isTeamLimitReached = teamMembersCount >= currentWorkspace?.team_seats;

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        setError,
        clearErrors,
        formState: { errors },
    } = useForm();

    useEffect(() => {
        register('unit_ids');
    }, [register]);

    const onSubmit = async (data) => {
        if (!canManageMembers) {
            toast.error('Only admins can manage users');
            return;
        }

        const unitIds = Array.isArray(data.unit_ids) ? data.unit_ids : [];
        if (unitIds.length === 0) {
            setError('unit_ids', {
                type: 'manual',
                message: 'Select at least one unit',
            });
            return;
        }

        if (editMember) {
            await updateWorkspaceMember(
                {
                    id: editMember.id,
                    role: data.role,
                    unit_ids: unitIds,
                    condo_id: condoId,
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
            // Check if email is already a member
            const normalizedEmail = String(data.email || '').trim().toLowerCase();
            const isDuplicate = workspaceMembers?.some(
                (member) => String(member.email || '').trim().toLowerCase() === normalizedEmail,
            );
            const isAlreadyInvited = pendingInvitations?.some(
                (invite) => String(invite.email || '').trim().toLowerCase() === normalizedEmail,
            );
            if (isDuplicate) {
                toast.error('This user is already a member');
            } else if (isAlreadyInvited) {
                toast.error('This user already has a pending invitation');
            } else {
                await addWorkspaceMember(
                    {
                        email: data.email,
                        role: data.role,
                        condo_id: condoId,
                        unit_ids: unitIds,
                    },
                    {
                        onSuccess: (result) => {
                            const generatedLink = String(result?.invitation_link || '').trim();
                            if (!generatedLink) {
                                toast.error('Invitation created but share link is missing');
                                return;
                            }
                            setInviteLinkToShare(generatedLink);
                            onInviteLinkOpen();
                            toast.success('Invitation created');
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

    const handleCopyInviteLink = async () => {
        const link = String(inviteLinkToShare || '').trim();
        if (!link) {
            toast.error('No invitation link available');
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Link copied');
        } catch {
            toast.error('Could not copy link');
        }
    };

    const handleDeleteInvitation = async (invitationId) => {
        if (!canManageMembers) return;
        try {
            await deleteCondoInvitation({ condo_id: condoId, id: invitationId });
            toast.success('Invitacion eliminada');
        } catch (error) {
            toast.error(error?.message || 'No se pudo eliminar la invitacion');
        }
    };

    const handleAddMember = () => {
        if (!canManageMembers) return;
        reset({ email: '', role: 'resident', unit_ids: [] });
        setFormKey((prev) => prev + 1);
        clearErrors();
        setEditMember(null);
        onOpen();
    };

    const handleEditMember = (member) => {
        if (!canManageMembers) return;
        setValue('email', member.email);
        setValue('role', member.role);
        const unitIds = Array.isArray(member.unit_ids) ? member.unit_ids : [];
        setValue('unit_ids', unitIds);
        setFormKey((prev) => prev + 1);
        clearErrors();
        setEditMember(member);
        onOpen();
    };

    const columns = [
        { name: 'Name', uid: 'name' },
        { name: 'Rol', uid: 'role' },
        { name: 'Residencia', uid: 'unit_display' },
        { name: 'Status', uid: 'status' },
        ...(canManageMembers ? [{ name: 'Actions', uid: 'actions' }] : []),
    ];

    return (
        <AppLayout>
            <PageLayout
                title="Usuarios"
                maxW="2xl"
                primaryAction={canManageMembers ? 'Agregar usuario' : undefined}
                description={
                    canManageMembers
                        ? 'Agrega usuarios existentes a tu condominio'
                        : 'Solo administradores pueden gestionar usuarios'
                }
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
                        <TableBody items={displayMembers}>
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
                                                canEdit={canManageMembers}
                                                canDelete={canManageMembers}
                                            />
                                        </TableCell>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {canManageMembers && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-2">Invitaciones pendientes</h3>
                            <Table aria-label="Pending invitations table">
                                <TableHeader>
                                    <TableColumn>Email</TableColumn>
                                    <TableColumn>Rol</TableColumn>
                                    <TableColumn>Residencia</TableColumn>
                                    <TableColumn>Status</TableColumn>
                                    <TableColumn>Expira</TableColumn>
                                    <TableColumn>Acciones</TableColumn>
                                </TableHeader>
                                <TableBody emptyContent="No hay invitaciones pendientes">
                                    {displayInvitations.map((invite) => (
                                        <TableRow key={`invite-${invite.id}`}>
                                            <TableCell>{invite.email || '—'}</TableCell>
                                            <TableCell className="capitalize">
                                                {invite.role || 'resident'}
                                            </TableCell>
                                            <TableCell>{invite.unit_display}</TableCell>
                                            <TableCell className="capitalize">
                                                {invite.status || 'pending'}
                                            </TableCell>
                                            <TableCell>
                                                {invite.expires_at
                                                    ? new Date(invite.expires_at).toLocaleDateString(
                                                          'es-MX',
                                                      )
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    color="danger"
                                                    variant="light"
                                                    isIconOnly
                                                    isLoading={isDeletingInvitation}
                                                    onPress={() =>
                                                        handleDeleteInvitation(invite.id)
                                                    }
                                                >
                                                    <RiDeleteBin6Line className="text-lg" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="xl">
                    <ModalContent>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <ModalHeader>
                                {editMember ? 'Edit team member' : 'Add team member'}
                            </ModalHeader>
                            <ModalBody>
                                {isTeamLimitReached && !editMember && (
                                    <Alert
                                        title="Team limit reached"
                                        description="You have reached your team seat limit. Upgrade your plan to invite more members."
                                        color="danger"
                                        icon="exclamation-circle"
                                    />
                                )}
                                <p>
                                    {editMember
                                        ? 'Update user details'
                                        : 'Invite a user by email'}
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
                                        label="Rol"
                                        className="basis-1/3"
                                        isDisabled={!canManageMembers}
                                        defaultSelectedKeys={
                                            editMember ? [editMember.role] : ['resident']
                                        }
                                    >
                                        <SelectItem key="resident">Resident</SelectItem>
                                        <SelectItem key="admin">Admin</SelectItem>
                                    </Select>
                                </div>
                                <div className="mt-2">
                                    <CreatableSelect
                                        key={formKey}
                                        label="Unidad"
                                        placeholder="Buscar unidad..."
                                        options={unitOptions}
                                        defaultValue={unitOptions.filter((option) =>
                                            (Array.isArray(editMember?.unit_ids)
                                                ? editMember.unit_ids
                                                : []
                                            ).includes(option.value),
                                        )}
                                        icon={<RiHome4Line className="text-base" />}
                                        multiple
                                        disabled={!canManageMembers}
                                        onChange={(values) => {
                                            setValue('unit_ids', values || []);
                                            clearErrors('unit_ids');
                                        }}
                                        onCreate={async (value) => {
                                            const address = String(value || '').trim();
                                            if (!address) return null;
                                            const unit = await createUnit({
                                                address,
                                                condo_id: condoId,
                                            });
                                            return {
                                                value: unit.id,
                                                label: unit.address,
                                            };
                                        }}
                                        triggerClassName="px-4 py-5 min-h-12 text-base max-w-full w-full justify-start"
                                    />
                                    {errors.unit_ids && (
                                        <p className="text-tiny text-danger mt-1">
                                            {errors.unit_ids.message}
                                        </p>
                                    )}
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
                <Modal
                    isOpen={isInviteLinkOpen}
                    onOpenChange={onInviteLinkOpenChange}
                    size="2xl"
                >
                    <ModalContent>
                        <ModalHeader>Usuario invitado</ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-default-600">
                                Comparte este enlace con el usuario para que termine su registro.
                            </p>
                            <div className="mt-1 flex items-end gap-2">
                                <Input
                                    label="Invitation URL"
                                    value={inviteLinkToShare}
                                    isReadOnly
                                    className="grow"
                                />
                                <Button
                                    isIconOnly
                                    color="primary"
                                    variant="flat"
                                    aria-label="Copiar enlace"
                                    onPress={handleCopyInviteLink}
                                >
                                    <RiFileCopyLine className="text-lg" />
                                </Button>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onInviteLinkClose}>
                                Cerrar
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </PageLayout>
        </AppLayout>
    );
}

export default TeamPage;
