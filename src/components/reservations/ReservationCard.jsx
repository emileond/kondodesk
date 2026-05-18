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
import {
    RiCalendarEventLine,
    RiTimeLine,
    RiAlertLine,
    RiUserLine,
    RiHome4Line,
} from 'react-icons/ri';
import { useUpdateReservation } from '../../hooks/react-query/reservations/useReservations.js';
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

function statusConfig(s) {
    const val = String(s || '').toLowerCase();
    if (val === 'confirmed') return { color: 'success', label: 'Confirmada' };
    if (val === 'pending') return { color: 'warning', label: 'Pendiente' };
    if (val === 'cancelled' || val === 'canceled') return { color: 'danger', label: 'Cancelada' };
    return { color: 'default', label: String(s || '') };
}

function ReservationCard({
    reservation,
    className = '',
    showStatus = true,
    amenityName,
    amenityIcon,
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

    const normalizedStatus = String(status || '').toLowerCase();
    const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
    const isPending = normalizedStatus === 'pending';
    const cfg = statusConfig(status);
    const canManageActions = Boolean(canManage && condoId && reservation?.id);

    // Time computation
    const startDj = start_time ? dayjs(start_time) : null;
    let endDj = end_time ? dayjs(end_time) : null;
    if (
        !endDj &&
        reservation_duration_minutes &&
        Number.isFinite(Number(reservation_duration_minutes))
    ) {
        endDj = startDj?.add(Number(reservation_duration_minutes), 'minute') ?? null;
    }
    const timeStart = fmtTime(startDj);
    const timeEnd = fmtTime(endDj);

    // Prefer explicit rangeLabel prop, otherwise build from times
    const timeDisplay =
        rangeLabel || (timeStart && timeEnd ? `${timeStart} – ${timeEnd}` : timeStart || null);

    // Date display
    const dateDisplay =
        typeof dateLabel === 'string'
            ? dateLabel
            : startDj?.isValid()
              ? startDj.format('ddd D [de] MMM YYYY')
              : null;

    const title = amenityName || 'Amenidad';
    const resolvedIconKey = amenityIcon ?? reservation?.amenity?.icon;

    const statusOptions = [
        { key: 'confirmed', label: 'Confirmada' },
        { key: 'pending', label: 'Pendiente' },
    ];

    const handleCardClick = () => {
        setStatusSelection(isCancelled ? '' : normalizedStatus);
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
        } catch {
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
        } catch {
            toast.error('No se pudo cancelar la reserva');
        }
    };

    useEffect(() => {
        if (!isOpen || userLabel || !reservation?.user_id) return;
        let alive = true;
        (async () => {
            setEmailLoading(true);
            try {
                const { data } = await supabaseClient
                    .from('profiles')
                    .select('email')
                    .eq('id', reservation.user_id)
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
    }, [isOpen, reservation?.user_id, userLabel]);

    const drawer = (
        <ReservationDrawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isCancelOpen={isCancelOpen}
            onCancelOpen={onCancelOpen}
            onCancelChange={onCancelChange}
            title={title}
            startDj={startDj}
            timeStart={timeStart}
            timeEnd={timeEnd}
            status={status}
            cfg={cfg}
            unitLabel={unitLabel}
            reservation={reservation}
            emailLoading={emailLoading}
            displayEmail={userLabel || profileEmail || '—'}
            canManageActions={canManageActions}
            isCancelled={isCancelled}
            statusOptions={statusOptions}
            statusSelection={statusSelection}
            setStatusSelection={setStatusSelection}
            isUpdating={isUpdating}
            normalizedStatus={normalizedStatus}
            handleUpdateStatus={handleUpdateStatus}
            handleCancelReservation={handleCancelReservation}
            canManage={canManage}
            userLabel={userLabel}
            profileEmail={profileEmail}
            amenityIconKey={resolvedIconKey}
        />
    );

    // ── Calendar variant — compact pill for month grid cells ─────────────────
    if (variant === 'calendar') {
        return (
            <>
                <button
                    type="button"
                    onClick={handleCardClick}
                    className={`w-full text-left rounded-md bg-content2 border border-default-200 px-1.5 py-1 hover:bg-default-100 transition-colors ${className}`}
                >
                    <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-default-800 truncate">
                            {title}
                        </span>
                        {showStatus && status && (
                            <Chip
                                size="sm"
                                color={cfg.color}
                                variant="flat"
                                className="shrink-0 h-4 text-[10px] px-1 min-w-0"
                            >
                                {cfg.label}
                            </Chip>
                        )}
                    </div>
                    {timeDisplay && (
                        <div className="text-[10px] text-default-400 mt-0.5 truncate">
                            {timeDisplay}
                        </div>
                    )}
                </button>
                {drawer}
            </>
        );
    }

    // ── Default variant ───────────────────────────────────────────────────────
    return (
        <>
            <button
                type="button"
                onClick={handleCardClick}
                className={`w-full text-left rounded-xl bg-content1 border border-default-200 px-4 py-3.5 hover:bg-default-50 hover:border-default-300 transition-all ${className}`}
            >
                {/* Row 1: amenity name + status chip */}
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {getAmenityIcon(resolvedIconKey, 'text-default-400 text-xl shrink-0')}
                        <span className="text-sm font-semibold text-default-800 truncate">
                            {title}
                        </span>
                    </div>
                    {showStatus && status && (
                        <Chip size="sm" color={cfg.color} variant="flat" className="shrink-0">
                            {cfg.label}
                        </Chip>
                    )}
                </div>

                {/* Row 2: date · time — inline with icons */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
                    {dateDisplay && (
                        <span className="flex items-center gap-1 text-xs text-default-500 capitalize">
                            <RiCalendarEventLine className="text-default-400 shrink-0" />
                            {dateDisplay}
                        </span>
                    )}
                    {timeDisplay && (
                        <span className="flex items-center gap-1 text-xs text-default-500">
                            <RiTimeLine className="text-default-400 shrink-0" />
                            {timeDisplay}
                        </span>
                    )}
                </div>

                {/* Row 3: pending nudge */}
                {isPending && (
                    <div className="flex items-center gap-1.5 mt-2.5 pl-6 text-xs text-warning-600">
                        <RiAlertLine className="shrink-0" />
                        <span>Pago pendiente · Contacta al administrador</span>
                    </div>
                )}
            </button>
            {drawer}
        </>
    );
}

// ── Detail drawer (shared between variants) ───────────────────────────────────
function ReservationDrawer({
    isOpen,
    onOpenChange,
    isCancelOpen,
    onCancelOpen,
    onCancelChange,
    title,
    startDj,
    timeStart,
    timeEnd,
    status,
    cfg,
    unitLabel,
    reservation,
    emailLoading,
    displayEmail,
    canManageActions,
    isCancelled,
    statusOptions,
    statusSelection,
    setStatusSelection,
    isUpdating,
    normalizedStatus,
    handleUpdateStatus,
    handleCancelReservation,
    canManage,
    userLabel,
    profileEmail,
    amenityIconKey,
}) {
    return (
        <>
            <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="right" size="md">
                <DrawerContent>
                    <DrawerHeader className="border-b border-default-100 pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 shrink-0">
                                    {getAmenityIcon(amenityIconKey, 'text-primary-600')}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-base font-semibold truncate">{title}</div>
                                    <div className="text-xs text-default-400">
                                        Detalle de reserva
                                    </div>
                                </div>
                            </div>
                            {status && (
                                <Chip
                                    size="sm"
                                    color={cfg.color}
                                    variant="flat"
                                    className="shrink-0"
                                >
                                    {cfg.label}
                                </Chip>
                            )}
                        </div>
                    </DrawerHeader>

                    <DrawerBody className="px-4 py-5 flex flex-col gap-4">
                        {/* Date/time block */}
                        <div className="rounded-xl border border-default-200 overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-default-100">
                                <div className="flex flex-col items-center gap-1 px-4 py-4">
                                    <RiCalendarEventLine className="text-default-400 text-xl mb-0.5" />
                                    <div className="text-[10px] text-default-400 font-medium uppercase tracking-wide">
                                        Fecha
                                    </div>
                                    <div className="text-sm font-bold text-default-800 text-center capitalize">
                                        {startDj?.isValid()
                                            ? startDj.format('ddd D [de] MMM')
                                            : '—'}
                                    </div>
                                    <div className="text-xs text-default-400">
                                        {startDj?.isValid() ? startDj.format('YYYY') : ''}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1 px-4 py-4">
                                    <RiTimeLine className="text-default-400 text-xl mb-0.5" />
                                    <div className="text-[10px] text-default-400 font-medium uppercase tracking-wide">
                                        Horario
                                    </div>
                                    <div className="text-sm font-bold text-default-800">
                                        {timeStart || '—'}
                                    </div>
                                    {timeEnd && (
                                        <div className="text-xs text-default-400">a {timeEnd}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Meta info */}
                        <div className="rounded-xl border border-default-200 divide-y divide-default-100 overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <RiHome4Line className="text-default-400 shrink-0 text-base" />
                                <span className="text-sm text-default-500">Unidad</span>
                                <span className="text-sm font-semibold text-default-800 ml-auto">
                                    {unitLabel || reservation?.unit_id || '—'}
                                </span>
                            </div>
                            {(canManage || userLabel || profileEmail || emailLoading) && (
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <RiUserLine className="text-default-400 shrink-0 text-base" />
                                    <span className="text-sm text-default-500">Usuario</span>
                                    <span className="text-sm font-semibold text-default-800 ml-auto truncate">
                                        {emailLoading ? 'Cargando…' : displayEmail}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Status change (admin) */}
                        {canManageActions && (
                            <>
                                <Divider />
                                <Select
                                    label="Cambiar estado"
                                    selectedKeys={statusSelection ? [statusSelection] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0];
                                        if (value) setStatusSelection(String(value));
                                    }}
                                    isDisabled={isCancelled}
                                >
                                    {statusOptions.map((o) => (
                                        <SelectItem key={o.key} value={o.key}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </>
                        )}
                    </DrawerBody>

                    {canManageActions && (
                        <DrawerFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end border-t border-default-100">
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
                            ¿Seguro que quieres cancelar esta reserva? Esta acción no se puede
                            deshacer.
                        </p>
                    </ModalBody>
                    <ModalFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button variant="light" onPress={onCancelChange}>
                            Volver
                        </Button>
                        <Button
                            color="danger"
                            isDisabled={isUpdating || isCancelled}
                            onPress={async () => {
                                await handleCancelReservation();
                                onCancelChange();
                            }}
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
