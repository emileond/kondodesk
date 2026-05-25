import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';
import dayjs from 'dayjs';
import AppLayout from '../components/layout/AppLayout.jsx';
import toast from 'react-hot-toast';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import { useAmenity, useAmenityRules } from '../hooks/react-query/amenities/useAmenities';
import { useAmenityAvailability, useCreateReservation, useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds } from '../hooks/react-query/units/useUnits.js';
import { RiMoneyDollarCircleLine, RiTimerLine } from 'react-icons/ri';

function titleCase(str = '') {
    return str
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function parseTimeToMinutes(timeStr = '00:00') {
    // accepts 'HH:mm' or 'HH:mm:ss'
    const [h, m] = timeStr.split(':');
    return parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);
}

function minutesToHHMM(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeIntl(hour, minute) {
    const dt = new Date(2000, 0, 1, hour, minute, 0, 0);
    return new Intl.DateTimeFormat('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(dt);
}

function ReservaAmenityPage() {
    const navigate = useNavigate();
    const { amenity: amenitySlug } = useParams();
    const [currentWorkspace] = useCurrentWorkspace();
    const amenityName = useMemo(
        () => titleCase(decodeURIComponent(amenitySlug || '')),
        [amenitySlug],
    );

    const { data: amenity, isPending: amenityLoading } = useAmenity(currentWorkspace, {
        name: amenityName,
    });

    const amenityId = amenity?.id;
    const { data: rules = [], isPending: rulesLoading } = useAmenityRules(currentWorkspace, {
        amenity_id: amenityId,
    });

    const { data: currentUser } = useUser();
    const { data: memberUnitIds = [], isPending: memberUnitsLoading } = useCondoMemberUnitIds(
        currentWorkspace,
        currentUser,
    );
    const unitId = memberUnitIds?.[0] || null;

    // Backend-derived availability that accounts for reservations and rules
    const { data: availData, isPending: availLoading } = useAmenityAvailability({
        condo_id: currentWorkspace?.condo_id,
        amenity_id: amenityId,
        unit_id: unitId,
        start: dayjs().startOf('day').format('YYYY-MM-DD'),
        days: 30,
        timezone_offset_minutes: new Date().getTimezoneOffset(),
    });

    const reservationsRangeStart = useMemo(() => dayjs().startOf('day'), []);
    const reservationsRangeEnd = useMemo(
        () => reservationsRangeStart.add(30, 'day').endOf('day'),
        [reservationsRangeStart],
    );
    const { data: reservations = [] } = useReservationsList({
        condo_id: currentWorkspace?.condo_id,
        unit_id: unitId,
        amenity_id: amenityId,
        from: reservationsRangeStart.toISOString(),
        to: reservationsRangeEnd.toISOString(),
    });

    const [availability, setAvailability] = useState({});
    const [userLimitByDate, setUserLimitByDate] = useState({});

    // Build helpers for cost and duration display
    const currencyCode = currentWorkspace?.currency || currentWorkspace?.curreny || 'MXN';
    const costLabel = amenity?.requires_payment
        ? Number.isFinite(Number(amenity?.cost))
            ? new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: currencyCode,
                  maximumFractionDigits: 0,
              }).format(Number(amenity?.cost))
            : 'Pago requerido'
        : null;

    const minSlot = useMemo(() => {
        return (
            rules
                ?.map((r) => Number(r.slot_duration_minutes))
                ?.filter((n) => Number.isFinite(n) && n > 0)
                ?.sort((a, b) => a - b)[0] || null
        );
    }, [JSON.stringify(rules)]);

    function formatDuration(mins) {
        if (!mins || isNaN(mins)) return null;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m === 0) return `${h} hrs`;
        if (h > 0) return `${h} h ${m} min`;
        return `${m} min`;
    }
    const durationLabel = formatDuration(minSlot);

    // Map DOW to slot duration for confirmation range
    const slotDurationByDow = useMemo(() => {
        const map = {};
        for (const r of rules || []) {
            const dow = Number(r.day_of_week);
            const dur = Number(r.slot_duration_minutes || 60);
            if (Number.isFinite(dow)) map[dow] = dur;
        }
        return map;
    }, [JSON.stringify(rules)]);

    const ruleByDow = useMemo(() => {
        const map = {};
        for (const r of rules || []) {
            const dow = Number(r.day_of_week);
            if (Number.isFinite(dow)) map[dow] = r;
        }
        return map;
    }, [JSON.stringify(rules)]);

    const reservationsByDate = useMemo(() => {
        const map = {};
        for (const r of reservations || []) {
            const status = String(r?.status || '').toLowerCase();
            if (status === 'cancelled' || status === 'canceled') continue;
            const dateKey = r?.start_time ? dayjs(r.start_time).format('YYYY-MM-DD') : null;
            if (!dateKey) continue;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(r);
        }
        return map;
    }, [JSON.stringify(reservations)]);

    useEffect(() => {
        if (availData) {
            const avail = availData.availability || availData; // backward compatibility
            const limits = availData.userLimitByDate || {};
            setAvailability(avail);
            setUserLimitByDate(limits);
        }
    }, [JSON.stringify(availData)]);

    const isLoading =
        amenityLoading || memberUnitsLoading || (amenityId && (rulesLoading || availLoading));

    const createReservation = useCreateReservation();

    // Helper to format start-end like 9-10 (omit :00)
    function formatRange(dateStr, startHHMM) {
        const [sh, sm] = (startHHMM || '00:00').split(':').map((v) => parseInt(v || '0', 10));
        const dow = dayjs(dateStr).day();
        const dur = Number(slotDurationByDow[dow] || 60);
        const end = dayjs().hour(sh).minute(sm).add(dur, 'minute');
        return `${formatTimeIntl(sh, sm)}-${formatTimeIntl(end.hour(), end.minute())}`;
    }

    return (
        <AppLayout>
            <PageLayout
                title={`Reservar ${amenityName}`}
                description="Selecciona un horario"
                customElements={
                    (costLabel || durationLabel) && (
                        <div className="mt-1 flex items-center gap-3 text-small text-default-600">
                            {costLabel && (
                                <span className="inline-flex items-center gap-1">
                                    <RiMoneyDollarCircleLine className="text-success" />
                                    <span>{costLabel}</span>
                                </span>
                            )}
                            {durationLabel && (
                                <span className="inline-flex items-center gap-1">
                                    <RiTimerLine className="text-primary" />
                                    <span>{durationLabel}</span>
                                </span>
                            )}
                        </div>
                    )
                }
                backBtn
            >
                {isLoading && <p className="text-default-500">Cargando disponibilidad…</p>}
                {!isLoading && (
                    <div className="pt-3">
                        <ReservationCalendar
                            availability={availability}
                            userLimitByDate={userLimitByDate}
                            amenityName={amenityName}
                            amenityIcon={amenity?.icon}
                            costLabel={costLabel}
                            slotDurationByDow={slotDurationByDow}
                            ruleByDow={ruleByDow}
                            amenityMaxCapacity={amenity?.max_capacity}
                            reservationsByDate={reservationsByDate}
                            onSelect={() => {}}
                            onCancelSelection={() => {}}
                            onConfirm={async (payload) => {
                                try {
                                    if (!unitId) {
                                        toast.error('No tienes una unidad asignada');
                                        return;
                                    }
                                    const [sh, sm] = (payload.time || '00:00')
                                        .split(':')
                                        .map((v) => parseInt(v || '0', 10));
                                    const startISO = dayjs(payload.date)
                                        .hour(sh)
                                        .minute(sm)
                                        .second(0)
                                        .millisecond(0)
                                        .toISOString();
                                    const dow = dayjs(payload.date).day();
                                    const reservation_duration_minutes = Number(
                                        slotDurationByDow[dow] || 60,
                                    );
                                    const rule = ruleByDow[dow];
                                    const isExclusive = Number(amenity?.max_capacity) === 1;

                                    const created = await createReservation.mutateAsync({
                                        condo_id: currentWorkspace?.condo_id,
                                        user_id: currentUser?.id,
                                        unit_id: unitId,
                                        amenity_id: amenityId,
                                        start_time: startISO,
                                        reservation_duration_minutes,
                                        timezone_offset_minutes: new Date().getTimezoneOffset(),
                                    });

                                    const status = created?.status;
                                    toast.success(
                                        status === 'pending'
                                            ? `Reserva creada como pendiente de pago: ${amenityName} el ${dayjs(payload.date).format('DD MMM YYYY')} ${formatRange(payload.date, payload.time)}`
                                            : `Reserva confirmada: ${amenityName} el ${dayjs(payload.date).format('DD MMM YYYY')} ${formatRange(payload.date, payload.time)}`,
                                    );
                                    // Navigate to confirmation view with details
                                    navigate('/reserva/confirmacion', {
                                        state: {
                                            reservation: created,
                                            amenityName,
                                            status,
                                            date: payload.date,
                                            time: payload.time,
                                            reservation_duration_minutes,
                                            rule_open_time: rule?.open_time || null,
                                            rule_close_time: rule?.close_time || null,
                                            amenity_max_capacity: amenity?.max_capacity ?? null,
                                            amenity_is_exclusive: isExclusive,
                                        },
                                    });
                                } catch (e) {
                                    console.error(e);
                                    toast.error('No se pudo crear la reserva');
                                }
                            }}
                        />
                    </div>
                )}
            </PageLayout>
        </AppLayout>
    );
}

export default ReservaAmenityPage;
