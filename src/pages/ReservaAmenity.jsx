import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';
import dayjs from 'dayjs';
import AppLayout from '../components/layout/AppLayout.jsx';
import toast from 'react-hot-toast';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import { useAmenity, useAmenityRules } from '../hooks/react-query/amenities/useAmenities';
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

function generateAvailabilityFromRules({
    rules = [],
    startDate = dayjs().startOf('day'),
    days = 30,
    now = dayjs(),
}) {
    const byDow = new Map();
    rules.forEach((r) => byDow.set(Number(r.day_of_week), r));

    const maxLead = Math.max(...rules.map((r) => Number(r.max_lead_time_days || 0)), days);

    const horizonDays = Math.max(days, isFinite(maxLead) ? maxLead : days);

    const result = {};
    let d = startDate.clone();
    for (let i = 0; i < horizonDays; i++) {
        const dow = d.day();
        const rule = byDow.get(dow);
        if (rule) {
            const openM = parseTimeToMinutes(String(rule.open_time).slice(0, 5));
            const closeM = parseTimeToMinutes(String(rule.close_time).slice(0, 5));
            const step = Number(rule.slot_duration_minutes || 60);
            const minLeadH = Number(rule.min_lead_time_hours || 0);
            const maxLeadD = Number(rule.max_lead_time_days || 365);

            const slots = [];
            for (let t = openM; t + step <= closeM; t += step) {
                const hhmm = minutesToHHMM(t);
                // Apply lead-time constraints
                const slotDateTime = d
                    .hour(parseInt(hhmm.slice(0, 2), 10))
                    .minute(parseInt(hhmm.slice(3, 5), 10));
                const diffHours = slotDateTime.diff(now, 'hour');
                const diffDays = slotDateTime.startOf('day').diff(now.startOf('day'), 'day');
                if (diffHours >= minLeadH && diffDays <= maxLeadD) {
                    slots.push(hhmm);
                }
            }
            if (slots.length > 0) {
                result[d.format('YYYY-MM-DD')] = slots;
            }
        }
        d = d.add(1, 'day');
    }
    return result;
}

function ReservaAmenityPage() {
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

    const [availability, setAvailability] = useState({});

    // Build helpers for cost and duration display
    const currencyCode = currentWorkspace?.currency || currentWorkspace?.curreny || 'MXN';
    const costLabel = amenity?.requires_payment
        ? Number.isFinite(Number(amenity?.cost))
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(Number(amenity?.cost))
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

    useEffect(() => {
        if (!amenityId) return;
        // Compute availability starting today
        const data = generateAvailabilityFromRules({
            rules,
            startDate: dayjs().startOf('day'),
            days: 30,
            now: dayjs(),
        });
        setAvailability(data);
    }, [amenityId, JSON.stringify(rules)]);

    const isLoading = amenityLoading || (amenityId && rulesLoading);

    // Helper to format start-end like 9-10 (omit :00)
    function formatRange(dateStr, startHHMM) {
        const [sh, sm] = (startHHMM || '00:00').split(':').map((v) => parseInt(v || '0', 10));
        const dow = dayjs(dateStr).day();
        const dur = Number(slotDurationByDow[dow] || 60);
        const end = dayjs().hour(sh).minute(sm).add(dur, 'minute');
        const fmt = (h, m) => (m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`);
        return `${fmt(sh, sm)}-${fmt(end.hour(), end.minute())}`;
    }

    return (
        <AppLayout>
            <PageLayout
                title={`Reservar ${amenityName}`}
                description="Selecciona un horario disponible"
                backBtn
            >
                {isLoading && <p className="text-default-500">Cargando disponibilidad…</p>}
                {!isLoading && (
                    <div className="flex flex-col gap-4">
                        {(costLabel || durationLabel) && (
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
                        )}
                        <ReservationCalendar
                            availability={availability}
                            amenityName={amenityName}
                            slotDurationByDow={slotDurationByDow}
                            onSelect={() => {}}
                            onCancelSelection={() => {}}
                            onConfirm={(payload) => {
                                toast.success(
                                    `Reserva confirmada: ${amenityName} el ${dayjs(payload.date).format('DD MMM YYYY')} ${formatRange(payload.date, payload.time)}`,
                                );
                            }}
                        />
                    </div>
                )}
            </PageLayout>
        </AppLayout>
    );
}

export default ReservaAmenityPage;
