import dayjs from 'dayjs';
import { Chip } from '@heroui/react';

function ReservationCard({ reservation, className = '', showStatus = true, amenityName }) {
    if (!reservation) return null;

    const { start_time, end_time, reservation_duration_minutes, status } = reservation;

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
    const dateLine = `${dayjs(start_time).format('DD MMM YYYY')} · ${formatRange(
        start_time,
        end_time,
        reservation_duration_minutes,
    )}`;

    return (
        <div className={`p-3 rounded-medium bg-content2 border border-default-100 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-small font-semibold truncate">{title}</div>
                    <div className="text-tiny text-default-500 mt-1 truncate">{dateLine}</div>
                </div>
                {showStatus && status && (
                    <Chip size="sm" {...statusToChipProps(status)} className="shrink-0">
                        {...statusToChipProps(status).label}
                    </Chip>
                )}
            </div>
        </div>
    );
}

export default ReservationCard;
