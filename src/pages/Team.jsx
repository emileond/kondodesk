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
import { useEffect, useMemo, useState } from 'react';
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
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
    const [editMember, setEditMember] = useState();
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
            if (isDuplicate) {
                toast.error('This user is already a member');
            } else {
                await addWorkspaceMember(
                    {
                        email: data.email,
                        role: data.role,
                        condo_id: condoId,
                        unit_ids: unitIds,
                    },
                    {
                        onSuccess: () => {
                            toast.success('Invitation sent');
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
        if (!canManageMembers) return;
        reset({ email: '', role: 'resident', unit_ids: [] });
        clearErrors();
        setFormKey((prev) => prev + 1);
        setEditMember(null);
        onOpen();
    };

    const handleEditMember = (member) => {
        if (!canManageMembers) return;
        setValue('email', member.email);
        setValue('role', member.role);
        setValue('unit_ids', Array.isArray(member.unit_ids) ? member.unit_ids : []);
        clearErrors();
        setFormKey((prev) => prev + 1);
        setEditMember(member);
        onOpen();
    };

    const columns = [
        { name: 'Name', uid: 'name' },
        { name: 'Role', uid: 'role' },
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
                                        label="Role"
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
                                        label="Units"
                                        placeholder="Search units..."
                                        options={unitOptions}
                                        defaultValue={unitOptions.filter((option) =>
                                            (Array.isArray(editMember?.unit_ids)
                                                ? editMember.unit_ids
                                                : []
                                            ).includes(option.value),
                                        )}
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
                                        triggerClassName="px-2"
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
            </PageLayout>
        </AppLayout>
    );
}

export default TeamPage;
