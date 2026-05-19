import dayjs from 'dayjs';
import { Chip, useDisclosure } from '@heroui/react';
import { RiAlertLine, RiCalendarEventLine, RiTimeLine } from 'react-icons/ri';
import { getAmenityIcon } from '../../utils/amenityIcon.jsx';
import ReservationDetailsDrawer from './ReservationDetailsDrawer.jsx';

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
    currentUserId,
}) {
    const safeReservation = reservation || {};
    const { start_time, end_time, reservation_duration_minutes, status } = safeReservation;
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const normalizedStatus = String(status || '').toLowerCase();
    const isPending = normalizedStatus === 'pending';
    const cfg = statusConfig(status);

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

    const timeDisplay =
        rangeLabel || (timeStart && timeEnd ? `${timeStart} – ${timeEnd}` : timeStart || null);
    const dateDisplay =
        typeof dateLabel === 'string'
            ? dateLabel
            : startDj?.isValid()
              ? startDj.format('ddd D [de] MMM YYYY')
              : null;

    const title = amenityName || safeReservation?.amenity?.name || 'Amenidad';
    const resolvedIconKey = amenityIcon ?? safeReservation?.amenity?.icon;

    const handleCardClick = () => {
        onPress?.(safeReservation);
        onOpen();
    };

    const detailsDrawer = (
        <ReservationDetailsDrawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            reservation={safeReservation}
            amenityName={title}
            amenityIcon={resolvedIconKey}
            unitLabel={unitLabel}
            userLabel={userLabel}
            canManage={canManage}
            condoId={condoId}
            currentUserId={currentUserId}
        />
    );

    if (!reservation) return null;

    if (variant === 'calendar') {
        return (
            <>
                <button
                    type="button"
                    onClick={handleCardClick}
                    className={`w-full text-left cursor-pointer rounded-md bg-content2 border border-default-200 px-1.5 py-1 hover:bg-default-100 transition-colors ${className}`}
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
                {detailsDrawer}
            </>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={handleCardClick}
                className={`w-full text-left cursor-pointer rounded-xl bg-content1 border border-default-200 px-4 py-3.5 hover:bg-default-50 hover:border-default-300 transition-all ${className}`}
            >
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

                {isPending && (
                    <div className="flex items-center gap-1.5 mt-2.5 pl-6 text-xs text-warning-600">
                        <RiAlertLine className="shrink-0" />
                        <span>Pago pendiente · Contacta al administrador</span>
                    </div>
                )}
            </button>
            {detailsDrawer}
        </>
    );
}

export default ReservationCard;
