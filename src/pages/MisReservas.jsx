import { Button, Chip, Select, SelectItem, Skeleton } from '@heroui/react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds, useUnitsList } from '../hooks/react-query/units/useUnits.js';
import { useAmenitiesList } from '../hooks/react-query/amenities/useAmenities.js';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../lib/supabase.js';
import dayjs from 'dayjs';
import {
    RiAddLine,
    RiAlertLine,
    RiCalendarEventLine,
    RiFilterLine,
} from 'react-icons/ri';

// ── Agenda helpers ─────────────────────────────────────────────────────────────
function groupReservations(reservations) {
    const today         = dayjs().startOf('day');
    const tomorrow      = today.add(1, 'day');
    const endThisWeek   = today.endOf('week');
    const startNextWeek = endThisWeek.add(1, 'day');
    const endNextWeek   = startNextWeek.endOf('week');

    const buckets = [
        { key: 'hoy',            label: 'Hoy',           items: [] },
        { key: 'manana',         label: 'Mañana',         items: [] },
        { key: 'esta_semana',    label: 'Esta semana',    items: [] },
        { key: 'proxima_semana', label: 'Próxima semana', items: [] },
        { key: 'mas_adelante',   label: 'Más adelante',   items: [] },
    ];

    for (const r of reservations) {
        const d = dayjs(r.start_time).startOf('day');
        if (d.isSame(today, 'day')) {
            buckets[0].items.push(r);
        } else if (d.isSame(tomorrow, 'day')) {
            buckets[1].items.push(r);
        } else if (d.isAfter(tomorrow) && !d.isAfter(endThisWeek)) {
            buckets[2].items.push(r);
        } else if (d.isAfter(endThisWeek) && !d.isAfter(endNextWeek)) {
            buckets[3].items.push(r);
        } else {
            buckets[4].items.push(r);
        }
    }

    return buckets.filter((b) => b.items.length > 0);
}

function AgendaSection({ label }) {
    return (
        <div className="flex items-center gap-2 pt-2 pb-0.5">
            <span className="text-xs font-semibold text-default-400 uppercase tracking-wide shrink-0">
                {label}
            </span>
            <div className="flex-1 h-px bg-default-100" />
        </div>
    );
}

function ListSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="rounded-xl h-16 w-full" />
            ))}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────
function MisReservasPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: currentUser } = useUser();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    const { data: currentMember } = useQuery({
        queryKey: ['condoMember', condoId, currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('condo_members')
                .select('role')
                .eq('condo_id', condoId)
                .eq('user_id', currentUser?.id)
                .maybeSingle();
            if (error) throw new Error('Failed to fetch user role');
            return data;
        },
        enabled: !!condoId && !!currentUser?.id,
        staleTime: 1000 * 60 * 5,
    });

    const isAdmin = currentMember?.role === 'admin';
    const { data: unitIds = [] } = useCondoMemberUnitIds(currentWorkspace, currentUser);
    const [selectedAmenity, setSelectedAmenity] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: reservations = [], isLoading } = useReservationsList({
        condo_id: condoId,
        is_admin: isAdmin,
        unit_ids: isAdmin ? undefined : unitIds,
        from: isAdmin ? undefined : fromISO,
        amenity_id: isAdmin && selectedAmenity !== 'all' ? selectedAmenity : undefined,
        status: isAdmin && selectedStatus !== 'all' ? selectedStatus : undefined,
    });

    const { data: units = [] } = useUnitsList(currentWorkspace, currentUser, { includeAll: isAdmin });
    const { data: amenities = [] } = useAmenitiesList(currentWorkspace, { onlyReservable: true });

    const unitLabelById = useMemo(
        () => new Map((units || []).map((u) => [String(u.id), u.address])),
        [units],
    );

    const reservationsByDate = useMemo(() => {
        const map = {};
        for (const r of reservations || []) {
            const status = String(r?.status || '').toLowerCase();
            const includeCancelled = isAdmin && selectedStatus === 'cancelled';
            if (!includeCancelled && (status === 'cancelled' || status === 'canceled')) continue;
            const dateKey = r?.start_time ? dayjs(r.start_time).format('YYYY-MM-DD') : null;
            if (!dateKey) continue;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(r);
        }
        return map;
    }, [JSON.stringify(reservations), isAdmin, selectedStatus]);

    const amenityOptions = useMemo(
        () => (amenities || []).map((a) => ({ key: String(a.id), label: a.name })),
        [amenities],
    );
    const statusOptions = [
        { key: 'confirmed', label: 'Confirmada' },
        { key: 'pending',   label: 'Pendiente'  },
        { key: 'cancelled', label: 'Cancelada'  },
    ];

    // User view derived data
    const agendaGroups = useMemo(
        () => groupReservations(reservations),
        [reservations],
    );
    const pendingCount = useMemo(
        () => reservations.filter((r) => String(r?.status || '').toLowerCase() === 'pending').length,
        [reservations],
    );

    // ── Admin view ─────────────────────────────────────────────────────────────
    if (isAdmin) {
        return (
            <AppLayout>
                <PageLayout
                    title="Reservas"
                    description="Calendario de reservas del condominio"
                    maxW="6xl"
                    backBtn
                >
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl bg-content2 border border-default-100">
                        <div className="flex items-center gap-1.5 text-default-500 text-sm shrink-0">
                            <RiFilterLine />
                            <span className="font-medium">Filtros</span>
                        </div>
                        <Select
                            variant="bordered"
                            label="Amenidad"
                            selectedKeys={[selectedAmenity]}
                            onSelectionChange={(keys) =>
                                setSelectedAmenity(String(Array.from(keys)[0] || 'all'))
                            }
                            size="sm"
                            className="max-w-[180px]"
                        >
                            <SelectItem key="all" value="all">Todas</SelectItem>
                            {amenityOptions.map((o) => (
                                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                            ))}
                        </Select>
                        <Select
                            variant="bordered"
                            size="sm"
                            label="Estado"
                            selectedKeys={[selectedStatus]}
                            onSelectionChange={(keys) =>
                                setSelectedStatus(String(Array.from(keys)[0] || 'all'))
                            }
                            className="max-w-[160px]"
                        >
                            <SelectItem key="all" value="all">Todos</SelectItem>
                            {statusOptions.map((o) => (
                                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                            ))}
                        </Select>
                    </div>

                    {isLoading ? (
                        <ListSkeleton />
                    ) : (
                        <ReservationCalendar
                            availability={{}}
                            userLimitByDate={{}}
                            reservationsByDate={reservationsByDate}
                            allowSelection={false}
                            showAvailability={false}
                            showReservationsAlways
                            unitLabelById={unitLabelById}
                            reservationCardProps={{ canManage: isAdmin, condoId }}
                        />
                    )}
                </PageLayout>
            </AppLayout>
        );
    }

    // ── User view ──────────────────────────────────────────────────────────────
    return (
        <AppLayout>
            <PageLayout
                title="Mis Reservas"
                description="Tus próximas reservas"
                maxW="4xl"
                backBtn
                customElements={
                    <Button
                        as={Link}
                        to="/amenidades"
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<RiAddLine />}
                        className="font-medium mt-1"
                    >
                        Nueva reserva
                    </Button>
                }
            >
                {isLoading ? (
                    <ListSkeleton />
                ) : agendaGroups.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {/* Pending banner */}
                        {pendingCount > 0 && (
                            <div className="mb-3 rounded-xl bg-warning-50 border border-warning-200 px-3 py-2.5 flex items-start gap-2">
                                <RiAlertLine className="text-warning-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-warning-700">
                                    Tienes{' '}
                                    <strong>
                                        {pendingCount} reserva{pendingCount > 1 ? 's' : ''}
                                    </strong>{' '}
                                    pendiente{pendingCount > 1 ? 's' : ''} de pago. Contacta al
                                    administrador para confirmarlas.
                                </p>
                            </div>
                        )}

                        {/* Agenda sections */}
                        {agendaGroups.map((group) => (
                            <div key={group.key} className="flex flex-col gap-2">
                                <AgendaSection label={group.label} />
                                {group.items.map((r, i) => (
                                    <ReservationCard
                                        key={r?.id || i}
                                        reservation={r}
                                        amenityName={r?.amenity?.name}
                                        amenityIcon={r?.amenity?.icon}
                                        unitLabel={unitLabelById.get(String(r?.unit_id)) || ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-14 gap-3 rounded-xl border border-dashed border-default-200">
                        <RiCalendarEventLine className="text-default-300 text-4xl" />
                        <div className="text-sm font-medium text-default-500">
                            No tienes reservas próximas
                        </div>
                        <div className="text-xs text-default-400 max-w-xs">
                            Reserva amenidades como el gimnasio, la terraza o la cancha de pádel.
                        </div>
                        <Button
                            as={Link}
                            to="/amenidades"
                            color="primary"
                            size="sm"
                            startContent={<RiAddLine />}
                            className="font-medium mt-1"
                        >
                            Reservar amenidades
                        </Button>
                    </div>
                )}
            </PageLayout>
        </AppLayout>
    );
}

export default MisReservasPage;
