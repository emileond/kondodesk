import dayjs from 'dayjs';
import {
    Button,
    Chip,
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
    useDisclosure,
} from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    RiArrowRightLine,
    RiCalendarEventLine,
    RiCheckLine,
    RiCloseCircleLine,
    RiHome4Line,
    RiTimeLine,
    RiUserLine,
    RiAlertLine,
} from 'react-icons/ri';
import {
    useCancelReservation,
    useUpdateReservation,
} from '../../hooks/react-query/reservations/useReservations.js';
import { supabaseClient } from '../../lib/supabase.js';
import { getAmenityIcon } from '../../utils/amenityIcon.jsx';

function fmtTime(dayjsObj) {
    if (!dayjsObj?.isValid()) return null;
    return new Intl.DateTimeFormat('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(dayjsObj.toDate());
}

function fmtFullDate(dayjsObj) {
    if (!dayjsObj?.isValid()) return null;
    return new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(dayjsObj.toDate());
}

function statusConfig(s) {
    const val = String(s || '').toLowerCase();
    if (val === 'confirmed') return { color: 'success', label: 'Confirmada', dot: 'bg-success-400' };
    if (val === 'pending') return { color: 'warning', label: 'Pendiente', dot: 'bg-warning-400' };
    if (val === 'cancelled' || val === 'canceled')
        return { color: 'danger', label: 'Cancelada', dot: 'bg-danger-400' };
    return { color: 'default', label: String(s || ''), dot: 'bg-default-400' };
}

const STATUS_OPTIONS = [
    { key: 'confirmed', label: 'Confirmada', color: 'success' },
    { key: 'pending', label: 'Pendiente', color: 'warning' },
];

function ReservationDetailsDrawer({
    isOpen,
    onOpenChange,
    reservation,
    amenityName,
    amenityIcon,
    unitLabel,
    userLabel,
    canManage = false,
    condoId,
    currentUserId,
}) {
    const safeReservation = reservation || {};
    const initialNormalizedStatus = String(safeReservation?.status || '').toLowerCase();
    const {
        isOpen: isCancelOpen,
        onOpen: onCancelOpen,
        onOpenChange: onCancelChange,
    } = useDisclosure();
    const [statusSelection, setStatusSelection] = useState(() =>
        initialNormalizedStatus === 'cancelled' || initialNormalizedStatus === 'canceled'
            ? ''
            : initialNormalizedStatus,
    );
    const [profileEmail, setProfileEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [unitAddress, setUnitAddress] = useState('');
    const [unitLoading, setUnitLoading] = useState(false);
    const { mutateAsync: updateReservation, isPending: isUpdatingStatus } = useUpdateReservation();
    const { mutateAsync: cancelReservation, isPending: isCancelling } = useCancelReservation();

    const { start_time, end_time, reservation_duration_minutes, status } = safeReservation;
    const resolvedCondoId = condoId || safeReservation?.condo_id;
    const normalizedStatus = String(status || '').toLowerCase();
    const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
    const requiresPayment = Boolean(safeReservation?.amenity?.requires_payment);
    const isFutureReservation = start_time ? dayjs(start_time).isAfter(dayjs()) : false;
    const canCancelByBusinessRule =
        isFutureReservation &&
        (!requiresPayment || (requiresPayment && normalizedStatus !== 'confirmed'));
    const canManageActions = Boolean(canManage && resolvedCondoId && safeReservation?.id);
    const canUserCancel = Boolean(
        !canManage &&
            safeReservation?.id &&
            resolvedCondoId &&
            currentUserId &&
            !isCancelled &&
            canCancelByBusinessRule,
    );
    const isUpdating = isUpdatingStatus || isCancelling;
    const hasStatusChanged = statusSelection && statusSelection !== normalizedStatus;

    const startDj = start_time ? dayjs(start_time) : null;
    const endDj = useMemo(() => {
        const explicitEnd = end_time ? dayjs(end_time) : null;
        if (explicitEnd) return explicitEnd;
        if (reservation_duration_minutes && Number.isFinite(Number(reservation_duration_minutes))) {
            return startDj?.add(Number(reservation_duration_minutes), 'minute') ?? null;
        }
        return null;
    }, [end_time, reservation_duration_minutes, startDj]);

    const durationMin = useMemo(() => {
        if (reservation_duration_minutes && Number.isFinite(Number(reservation_duration_minutes))) {
            return Number(reservation_duration_minutes);
        }
        if (endDj && startDj) return endDj.diff(startDj, 'minute');
        return null;
    }, [reservation_duration_minutes, endDj, startDj]);

    const durationLabel = useMemo(() => {
        if (!durationMin) return null;
        const h = Math.floor(durationMin / 60);
        const m = durationMin % 60;
        if (h > 0 && m > 0) return `${h}h ${m}min`;
        if (h > 0) return `${h}h`;
        return `${m}min`;
    }, [durationMin]);

    const timeStart = fmtTime(startDj);
    const timeEnd = fmtTime(endDj);
    const fullDate = fmtFullDate(startDj);
    const cfg = statusConfig(status);
    const title = amenityName || safeReservation?.amenity?.name || 'Amenidad';
    const amenityIconKey = amenityIcon ?? safeReservation?.amenity?.icon;

    useEffect(() => {
        if (!isOpen || userLabel || !safeReservation?.user_id) return;
        let alive = true;
        (async () => {
            setEmailLoading(true);
            try {
                const { data } = await supabaseClient
                    .from('profiles')
                    .select('email')
                    .eq('user_id', safeReservation.user_id)
                    .maybeSingle();
                if (alive) setProfileEmail(data?.email || '');
            } catch {
                if (alive) setProfileEmail('');
            } finally {
                if (alive) setEmailLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [isOpen, safeReservation?.user_id, userLabel]);

    useEffect(() => {
        if (!isOpen || unitLabel || !safeReservation?.unit_id) return;
        let alive = true;
        (async () => {
            setUnitLoading(true);
            try {
                const { data } = await supabaseClient
                    .from('units')
                    .select('address')
                    .eq('id', safeReservation.unit_id)
                    .maybeSingle();
                if (alive) setUnitAddress(data?.address || '');
            } catch {
                if (alive) setUnitAddress('');
            } finally {
                if (alive) setUnitLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [isOpen, unitLabel, safeReservation?.unit_id]);

    const handleUpdateStatus = async () => {
        if (!canManageActions || !statusSelection) return;
        try {
            const updated = await updateReservation({
                reservation_id: safeReservation.id,
                condo_id: resolvedCondoId,
                status: statusSelection,
            });
            const next = String(updated?.status || statusSelection).toLowerCase();
            setStatusSelection(next === 'cancelled' || next === 'canceled' ? '' : next);
            toast.success('Reserva actualizada');
        } catch {
            toast.error('No se pudo actualizar la reserva');
        }
    };

    const handleCancelReservation = async () => {
        if (!canManageActions) return;
        try {
            await updateReservation({
                reservation_id: safeReservation.id,
                condo_id: resolvedCondoId,
                status: 'cancelled',
            });
            setStatusSelection('');
            toast.success('Reserva cancelada');
        } catch {
            toast.error('No se pudo cancelar la reserva');
        }
    };

    const handleUserCancelReservation = async () => {
        if (!canUserCancel) return;
        try {
            await cancelReservation({
                reservation_id: safeReservation.id,
                condo_id: resolvedCondoId,
                user_id: currentUserId,
            });
            toast.success('Reservación cancelada');
        } catch (error) {
            toast.error(error?.message || 'No se pudo cancelar la reservación');
        }
    };

    if (!reservation) return null;

    return (
        <>
            <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="right" size="md">
                <DrawerContent>
                    {/* ── Header ── */}
                    <DrawerHeader className="border-b border-default-100 pb-4 pt-5">
                        <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 shrink-0 mt-0.5">
                                {getAmenityIcon(amenityIconKey, 'text-primary-500 text-xl')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-default-400 font-medium mb-0.5">
                                    Detalle de reservación
                                </p>
                                <h2 className="text-base font-bold text-default-900 truncate leading-tight">
                                    {title}
                                </h2>
                                {status && (
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                                        <span
                                            className={`text-xs font-semibold text-${cfg.color}-600`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DrawerHeader>

                    {/* ── Body ── */}
                    <DrawerBody className="px-4 py-5 flex flex-col gap-5">
                        {/* Date & Time card */}
                        <div
                            className={`rounded-xl border overflow-hidden ${isCancelled ? 'border-default-100 bg-default-50/50 opacity-60' : 'border-default-200 bg-default-50'}`}
                        >
                            {/* Date row */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-default-100">
                                <RiCalendarEventLine className="text-default-400 shrink-0 text-lg" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-default-400 font-medium uppercase tracking-wide mb-0.5">
                                        Fecha
                                    </p>
                                    <p className="text-sm font-semibold text-default-800 capitalize">
                                        {fullDate || '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Time row */}
                            <div className="flex items-center gap-3 px-4 py-3">
                                <RiTimeLine className="text-default-400 shrink-0 text-lg" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-default-400 font-medium uppercase tracking-wide mb-0.5">
                                        Horario
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-default-800">
                                            {timeStart || '—'}
                                        </span>
                                        {timeEnd && (
                                            <>
                                                <RiArrowRightLine className="text-default-300 text-sm shrink-0" />
                                                <span className="text-sm font-semibold text-default-800">
                                                    {timeEnd}
                                                </span>
                                            </>
                                        )}
                                        {durationLabel && (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color="default"
                                                className="ml-1 text-[10px] h-5 px-1.5"
                                            >
                                                {durationLabel}
                                            </Chip>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Unit & User info */}
                        <div>
                            <p className="text-[10px] text-default-400 font-semibold uppercase tracking-wider mb-2 px-0.5">
                                Información
                            </p>
                            <div className="rounded-xl border border-default-200 divide-y divide-default-100 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <RiHome4Line className="text-default-400 shrink-0 text-base" />
                                    <span className="text-sm text-default-500 shrink-0">
                                        Unidad
                                    </span>
                                    <span className="text-sm font-semibold text-default-800 ml-auto truncate">
                                        {unitLoading
                                            ? 'Cargando…'
                                            : unitLabel ||
                                              unitAddress ||
                                              safeReservation?.unit_id ||
                                              '—'}
                                    </span>
                                </div>
                                {(canManage ||
                                    userLabel ||
                                    profileEmail ||
                                    emailLoading) && (
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <RiUserLine className="text-default-400 shrink-0 text-base" />
                                        <span className="text-sm text-default-500 shrink-0">
                                            Residente
                                        </span>
                                        <span className="text-sm font-semibold text-default-800 ml-auto truncate">
                                            {emailLoading
                                                ? 'Cargando…'
                                                : userLabel || profileEmail || '—'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Admin: status management */}
                        {canManageActions && (
                            <div>
                                <p className="text-[10px] text-default-400 font-semibold uppercase tracking-wider mb-2 px-0.5">
                                    Cambiar estado
                                </p>
                                <div
                                    className={`grid grid-cols-2 gap-2 ${isCancelled ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    {STATUS_OPTIONS.map((opt) => {
                                        const isSelected = statusSelection === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                disabled={isCancelled}
                                                onClick={() => setStatusSelection(opt.key)}
                                                className={[
                                                    'relative flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150 cursor-pointer',
                                                    isSelected
                                                        ? opt.color === 'success'
                                                            ? 'border-success-400 bg-success-50 text-success-700'
                                                            : 'border-warning-400 bg-warning-50 text-warning-700'
                                                        : 'border-default-200 bg-default-50 text-default-500 hover:border-default-300 hover:bg-default-100',
                                                ].join(' ')}
                                            >
                                                {isSelected && (
                                                    <RiCheckLine className="text-base shrink-0" />
                                                )}
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {isCancelled && (
                                    <p className="text-xs text-default-400 mt-2 text-center">
                                        Esta reservación ya fue cancelada
                                    </p>
                                )}
                            </div>
                        )}
                    </DrawerBody>

                    {/* ── Footer ── */}
                    {(canManageActions || canUserCancel) && (
                        <DrawerFooter className="border-t border-default-100 flex flex-col gap-2 pt-3">
                            {canManageActions && (
                                <Button
                                    color="primary"
                                    fullWidth
                                    isDisabled={isUpdating || isCancelled || !hasStatusChanged}
                                    isLoading={isUpdatingStatus && !isCancelling}
                                    onPress={handleUpdateStatus}
                                    startContent={
                                        !isUpdatingStatus && <RiCheckLine className="text-base" />
                                    }
                                >
                                    Guardar cambios
                                </Button>
                            )}
                            <Button
                                color="danger"
                                variant="flat"
                                fullWidth
                                isDisabled={isUpdating || isCancelled}
                                onPress={onCancelOpen}
                                startContent={<RiCloseCircleLine className="text-base" />}
                            >
                                Cancelar reservación
                            </Button>
                        </DrawerFooter>
                    )}
                </DrawerContent>
            </Drawer>

            {/* Cancel confirmation modal */}
            <Modal isOpen={isCancelOpen} onOpenChange={onCancelChange} size="sm">
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 pb-2">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-danger-50 shrink-0">
                            <RiAlertLine className="text-danger-500 text-lg" />
                        </div>
                        <span>¿Cancelar reservación?</span>
                    </ModalHeader>
                    <ModalBody className="pb-2">
                        {/* Summary of what's being cancelled */}
                        <div className="rounded-xl bg-default-50 border border-default-200 px-4 py-3 mb-2 flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 shrink-0">
                                {getAmenityIcon(amenityIconKey, 'text-primary-500 text-sm')}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-default-800 truncate">
                                    {title}
                                </p>
                                <p className="text-xs text-default-400 capitalize">
                                    {fullDate || '—'}
                                    {timeStart && ` · ${timeStart}`}
                                    {timeEnd && ` — ${timeEnd}`}
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-default-600">
                            Esta acción no se puede deshacer. La reservación quedará marcada como
                            cancelada.
                        </p>
                    </ModalBody>
                    <ModalFooter className="flex gap-2 pt-3">
                        <Button variant="flat" color="default" fullWidth onPress={onCancelChange}>
                            No, regresar
                        </Button>
                        <Button
                            color="danger"
                            fullWidth
                            isDisabled={isUpdating || isCancelled}
                            isLoading={isUpdating}
                            onPress={async () => {
                                if (canManageActions) {
                                    await handleCancelReservation();
                                } else {
                                    await handleUserCancelReservation();
                                }
                                onCancelChange();
                            }}
                        >
                            Sí, cancelar
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export default ReservationDetailsDrawer;
