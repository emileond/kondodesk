import dayjs from 'dayjs';
import {
    Button,
    Chip,
    Divider,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Select,
    SelectItem,
    useDisclosure,
} from '@heroui/react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useUpdateReservation } from '../../hooks/react-query/reservations/useReservations.js';
import { supabaseClient } from '../../lib/supabase.js';

function ReservationCard({
    reservation,
    className = '',
    showStatus = true,
    amenityName,
    rangeLabel,
    dateLabel,
    variant = 'default',
    onPress,
    unitLabel,
    userLabel,
    canManage = false,
    condoId,
}) {
    if (!reservation) return null;

    const { start_time, end_time, reservation_duration_minutes, status } = reservation;
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const {
        isOpen: isCancelOpen,
        onOpen: onCancelOpen,
        onOpenChange: onCancelChange,
    } = useDisclosure();
    const [statusSelection, setStatusSelection] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const { mutateAsync: updateReservation, isPending: isUpdating } = useUpdateReservation();

    function formatRange(startISO, endISO, durationMinutes) {
        const start = dayjs(startISO);
        let end = endISO ? dayjs(endISO) : null;
        if (!end && durationMinutes && Number.isFinite(Number(durationMinutes))) {
            end = start.add(Number(durationMinutes), 'minute');
        }
        if (!start.isValid()) return '';
        const from = start.format('HH:mm');
        const to = end && end.isValid() ? end.format('HH:mm') : '';
        return to ? `${from}-${to}` : from;
    }

    function statusToChipProps(s) {
        const val = String(s || '').toLowerCase();
        if (val === 'confirmed') return { color: 'success', variant: 'flat', label: 'Confirmada' };
        if (val === 'pending') return { color: 'primary', variant: 'flat', label: 'Pendiente' };
        if (val === 'cancelled' || val === 'canceled')
            return { color: 'danger', variant: 'flat', label: 'Cancelada' };
        return { color: 'default', variant: 'flat' };
    }

    const title = amenityName || 'Amenidad';
    const defaultRangeLabel =
        rangeLabel || formatRange(start_time, end_time, reservation_duration_minutes);
    const dateLine =
        typeof dateLabel === 'string'
            ? dateLabel
            : `${dayjs(start_time).format('DD MMM YYYY')} · ${defaultRangeLabel}`;

    const baseClass =
        variant === 'calendar'
            ? 'p-2 rounded-medium bg-content1 border border-default-200 text-left'
            : 'p-3 rounded-medium bg-content2 border border-default-100 text-left';
    const textClass = variant === 'calendar' ? 'text-xs' : 'text-small';
    const dateClass = variant === 'calendar' ? 'text-[11px]' : 'text-tiny';
    const chipSize = variant === 'calendar' ? 'sm' : 'sm';

    const normalizedStatus = String(status || '').toLowerCase();
    const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
    const canManageActions = Boolean(canManage && condoId && reservation?.id);
    const statusOptions = [
        { key: 'confirmed', label: 'Confirmada' },
        { key: 'pending', label: 'Pendiente' },
    ];

    const handleCardClick = () => {
        const nextStatus = String(status || 'pending').toLowerCase();
        setStatusSelection(
            nextStatus === 'cancelled' || nextStatus === 'canceled' ? '' : nextStatus,
        );
        onPress?.(reservation);
        onOpen();
    };

    const handleUpdateStatus = async () => {
        if (!canManageActions || !statusSelection) return;
        try {
            const updated = await updateReservation({
                reservation_id: reservation.id,
                condo_id: condoId,
                status: statusSelection,
            });
            const next = String(updated?.status || statusSelection).toLowerCase();
            setStatusSelection(next === 'cancelled' || next === 'canceled' ? '' : next);
            toast.success('Reserva actualizada');
        } catch (error) {
            toast.error('No se pudo actualizar la reserva');
        }
    };

    const handleCancelReservation = async () => {
        if (!canManageActions) return;
        try {
            await updateReservation({
                reservation_id: reservation.id,
                condo_id: condoId,
                status: 'cancelled',
            });
            setStatusSelection('');
            toast.success('Reserva cancelada');
        } catch (error) {
            toast.error('No se pudo cancelar la reserva');
        }
    };

    const detailRange = formatRange(start_time, end_time, reservation_duration_minutes);
    const detailDate = start_time ? dayjs(start_time).format('DD MMM YYYY') : '—';
    const displayEmail = userLabel || profileEmail || '—';

    useEffect(() => {
        if (!isOpen || userLabel || !reservation?.user_id) return;
        let isMounted = true;
        const fetchEmail = async () => {
            try {
                setEmailLoading(true);
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('email')
                    .eq('id', reservation.user_id)
                    .maybeSingle();
                if (error) throw error;
                if (isMounted) setProfileEmail(data?.email || '');
            } catch (error) {
                if (isMounted) setProfileEmail('');
            } finally {
                if (isMounted) setEmailLoading(false);
            }
        };
        fetchEmail();
        return () => {
            isMounted = false;
        };
    }, [isOpen, reservation?.user_id, userLabel]);

    return (
        <>
            <button
                type="button"
                onClick={handleCardClick}
                className={`${baseClass} ${className} cursor-pointer w-full hover:bg-default-50 transition-colors`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className={`${textClass} font-semibold truncate`}>{title}</div>
                        <div className={`${dateClass} text-default-500 mt-1 truncate`}>
                            {dateLine}
                        </div>
                    </div>
                    {showStatus && status && (
                        <Chip size={chipSize} {...statusToChipProps(status)} className="shrink-0">
                            {...statusToChipProps(status).label}
                        </Chip>
                    )}
                </div>
            </button>
            <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="right" size="md">
                <DrawerContent>
                    <DrawerHeader>Detalle de reserva</DrawerHeader>
                    <DrawerBody>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{title}</div>
                                    <div className="text-xs text-default-500 mt-1">
                                        {detailDate} · {detailRange || '—'}
                                    </div>
                                </div>
                                {status && (
                                    <Chip
                                        size="sm"
                                        {...statusToChipProps(status)}
                                        className="shrink-0"
                                    >
                                        {...statusToChipProps(status).label}
                                    </Chip>
                                )}
                            </div>
                            <Divider />
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-default-500">Unidad</span>
                                    <span className="font-medium">
                                        {unitLabel || reservation?.unit_id || '—'}
                                    </span>
                                </div>
                                {(canManage || userLabel || profileEmail || emailLoading) && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-default-500">Usuario</span>
                                        <span className="font-medium">
                                            {emailLoading ? 'Cargando…' : displayEmail}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-default-500">Estado</span>
                                    <span className="font-medium">
                                        {statusToChipProps(status).label}
                                    </span>
                                </div>
                            </div>
                            {canManageActions && <Divider />}
                            {canManageActions && (
                                <Select
                                    label="Cambiar estado"
                                    selectedKeys={statusSelection ? [statusSelection] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0];
                                        if (value) setStatusSelection(String(value));
                                    }}
                                    isDisabled={isCancelled}
                                >
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.key} value={option.key}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </Select>
                            )}
                        </div>
                    </DrawerBody>
                    {canManageActions && (
                        <DrawerFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button
                                color="danger"
                                variant="flat"
                                isDisabled={isUpdating || isCancelled}
                                onPress={onCancelOpen}
                            >
                                Cancelar reserva
                            </Button>
                            <Button
                                color="primary"
                                isDisabled={
                                    isUpdating ||
                                    isCancelled ||
                                    !statusSelection ||
                                    statusSelection === normalizedStatus
                                }
                                onPress={handleUpdateStatus}
                            >
                                Actualizar estado
                            </Button>
                        </DrawerFooter>
                    )}
                </DrawerContent>
            </Drawer>
            <Modal isOpen={isCancelOpen} onOpenChange={onCancelChange} size="sm">
                <ModalContent>
                    <ModalHeader>Cancelar reserva</ModalHeader>
                    <ModalBody>
                        <p className="text-sm text-default-600">
                            ¿Seguro que quieres cancelar esta reserva? Esta acci&oacute;n no se
                            puede deshacer.
                        </p>
                    </ModalBody>
                    <ModalFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button variant="light" onPress={onCancelChange}>
                            Volver
                        </Button>
                        <Button
                            color="danger"
                            onPress={async () => {
                                await handleCancelReservation();
                                onCancelChange();
                            }}
                            isDisabled={isUpdating || isCancelled}
                        >
                            Cancelar reserva
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export default ReservationCard;
