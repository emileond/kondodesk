import { Button, Chip, Pagination, Select, SelectItem, Skeleton, Tooltip } from '@heroui/react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import ReservationDetailsDrawer from '../components/reservations/ReservationDetailsDrawer.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';
import DataGrid from '../components/common/DataGrid.jsx';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds, useUnitsList } from '../hooks/react-query/units/useUnits.js';
import { useAmenitiesList } from '../hooks/react-query/amenities/useAmenities.js';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { supabaseClient } from '../lib/supabase.js';
import dayjs from 'dayjs';
import { getAmenityIcon } from '../utils/amenityIcon.jsx';
import {
    RiAddLine,
    RiAlertLine,
    RiCalendar2Line,
    RiCalendarEventLine,
    RiFilterLine,
    RiTableView,
} from 'react-icons/ri';

const HISTORY_PAGE_SIZE = 12;

// ── Agenda helpers ─────────────────────────────────────────────────────────────
function groupReservations(reservations) {
    const today = dayjs().startOf('day');
    const now = dayjs();
    const tomorrow = today.add(1, 'day');
    const endThisWeek = today.endOf('week');
    const startNextWeek = endThisWeek.add(1, 'day');
    const endNextWeek = startNextWeek.endOf('week');

    const buckets = [
        { key: 'historial', label: 'Historial', items: [] },
        { key: 'hoy', label: 'Hoy', items: [] },
        { key: 'manana', label: 'Mañana', items: [] },
        { key: 'esta_semana', label: 'Esta semana', items: [] },
        { key: 'proxima_semana', label: 'Próxima semana', items: [] },
        { key: 'mas_adelante', label: 'Más adelante', items: [] },
    ];

    for (const r of reservations) {
        const start = dayjs(r.start_time);
        const d = start.startOf('day');
        if (start.isBefore(now)) {
            buckets[0].items.push(r);
        } else if (d.isSame(today, 'day')) {
            buckets[1].items.push(r);
        } else if (d.isSame(tomorrow, 'day')) {
            buckets[2].items.push(r);
        } else if (d.isAfter(tomorrow) && !d.isAfter(endThisWeek)) {
            buckets[3].items.push(r);
        } else if (d.isAfter(endThisWeek) && !d.isAfter(endNextWeek)) {
            buckets[4].items.push(r);
        } else {
            buckets[5].items.push(r);
        }
    }

    if (buckets[0].items.length > 0) {
        buckets[0].items.sort(
            (a, b) => dayjs(b.start_time).valueOf() - dayjs(a.start_time).valueOf(),
        );
    }

    return buckets.filter((b) => b.items.length > 0);
}

function groupHistoricalReservations(reservations) {
    const today = dayjs().startOf('day');
    const yesterday = today.subtract(1, 'day');
    const startThisWeek = today.startOf('week');
    const startLastWeek = startThisWeek.subtract(1, 'week');
    const endLastWeek = startThisWeek.subtract(1, 'day');
    const startThisMonth = today.startOf('month');

    const buckets = [
        { key: 'ayer', label: 'Ayer', items: [] },
        { key: 'esta_semana', label: 'Esta semana', items: [] },
        { key: 'semana_pasada', label: 'Semana pasada', items: [] },
        { key: 'este_mes', label: 'Este mes', items: [] },
        { key: 'meses_anteriores', label: 'Meses anteriores', items: [] },
    ];

    for (const r of reservations || []) {
        const d = dayjs(r?.start_time).startOf('day');
        if (d.isSame(yesterday, 'day')) {
            buckets[0].items.push(r);
        } else if (!d.isBefore(startThisWeek)) {
            buckets[1].items.push(r);
        } else if (!d.isBefore(startLastWeek) && !d.isAfter(endLastWeek)) {
            buckets[2].items.push(r);
        } else if (!d.isBefore(startThisMonth)) {
            buckets[3].items.push(r);
        } else {
            buckets[4].items.push(r);
        }
    }

    for (const b of buckets) {
        if (b.items.length > 1) {
            b.items.sort((a, c) => dayjs(c?.start_time).valueOf() - dayjs(a?.start_time).valueOf());
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

function TimelineFilter({ value, onChange }) {
    const options = [
        { key: 'future', label: 'Próximas' },
        { key: 'history', label: 'Historial' },
        { key: 'all', label: 'Todas' },
    ];
    return (
        <div className="inline-flex rounded-lg border border-default-200 p-1 bg-content1">
            {options.map((opt) => (
                <Button
                    key={opt.key}
                    size="sm"
                    variant={value === opt.key ? 'solid' : 'light'}
                    color={value === opt.key ? 'primary' : 'default'}
                    onPress={() => onChange(opt.key)}
                    className="min-w-[96px]"
                >
                    {opt.label}
                </Button>
            ))}
        </div>
    );
}

function AdminViewToggle({ value, onChange }) {
    return (
        <div className="inline-flex rounded-lg border border-default-200 p-1 bg-content1">
            <Tooltip content="Tabla" placement="bottom">
                <Button
                    isIconOnly
                    size="sm"
                    variant={value === 'table' ? 'solid' : 'light'}
                    color={value === 'table' ? 'primary' : 'default'}
                    onPress={() => onChange('table')}
                    aria-label="Vista de tabla"
                >
                    <RiTableView className="text-base" />
                </Button>
            </Tooltip>
            <Tooltip content="Calendario" placement="bottom">
                <Button
                    isIconOnly
                    size="sm"
                    variant={value === 'calendar' ? 'solid' : 'light'}
                    color={value === 'calendar' ? 'primary' : 'default'}
                    onPress={() => onChange('calendar')}
                    aria-label="Vista de calendario"
                >
                    <RiCalendar2Line className="text-base" />
                </Button>
            </Tooltip>
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
    const [selectedUnit, setSelectedUnit] = useState('all');
    const [timelineView, setTimelineView] = useState('future');
    const [historyPage, setHistoryPage] = useState(1);
    const [adminViewMode, setAdminViewMode] = useState('table');
    const [tableDetailReservation, setTableDetailReservation] = useState(null);
    const [isTableDetailOpen, setIsTableDetailOpen] = useState(false);

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: reservations = [], isLoading } = useReservationsList({
        condo_id: condoId,
        is_admin: isAdmin,
        unit_id: isAdmin && selectedUnit !== 'all' ? selectedUnit : undefined,
        unit_ids: isAdmin ? undefined : unitIds,
        from: isAdmin ? undefined : fromISO,
        amenity_id: isAdmin && selectedAmenity !== 'all' ? selectedAmenity : undefined,
        status: isAdmin && selectedStatus !== 'all' ? selectedStatus : undefined,
    });

    const { data: units = [] } = useUnitsList(currentWorkspace, currentUser, {
        includeAll: isAdmin,
    });
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
    }, [reservations, isAdmin, selectedStatus]);

    const amenityOptions = useMemo(
        () => (amenities || []).map((a) => ({ key: String(a.id), label: a.name })),
        [amenities],
    );
    const unitOptions = useMemo(
        () => (units || []).map((u) => ({ key: String(u.id), label: u.address || `Unidad ${u.id}` })),
        [units],
    );
    const statusOptions = [
        { key: 'confirmed', label: 'Confirmada', color: 'success' },
        { key: 'pending', label: 'Pendiente', color: 'warning' },
        { key: 'cancelled', label: 'Cancelada', color: 'danger' },
    ];

    // User view derived data
    const futureReservations = useMemo(
        () => (reservations || []).filter((r) => dayjs(r?.start_time).isAfter(dayjs())),
        [reservations],
    );
    const historicalReservations = useMemo(
        () => (reservations || []).filter((r) => !dayjs(r?.start_time).isAfter(dayjs())),
        [reservations],
    );
    const historicalSorted = useMemo(
        () =>
            [...historicalReservations].sort(
                (a, b) => dayjs(b?.start_time).valueOf() - dayjs(a?.start_time).valueOf(),
            ),
        [historicalReservations],
    );

    const totalHistoryPages = useMemo(
        () => Math.max(1, Math.ceil(historicalSorted.length / HISTORY_PAGE_SIZE)),
        [historicalSorted],
    );
    const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
    const paginatedHistoricalReservations = useMemo(() => {
        const startIdx = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
        return historicalSorted.slice(startIdx, startIdx + HISTORY_PAGE_SIZE);
    }, [historicalSorted, safeHistoryPage]);

    const handleTimelineChange = (nextView) => {
        setTimelineView(nextView);
        if (nextView === 'history') setHistoryPage(1);
    };

    const visibleReservations = useMemo(() => {
        if (timelineView === 'history') return paginatedHistoricalReservations;
        if (timelineView === 'all') return reservations || [];
        return futureReservations;
    }, [timelineView, paginatedHistoricalReservations, reservations, futureReservations]);

    const agendaGroups = useMemo(
        () =>
            timelineView === 'history'
                ? groupHistoricalReservations(visibleReservations)
                : groupReservations(visibleReservations),
        [timelineView, visibleReservations],
    );

    const adminTableData = useMemo(() => {
        if (timelineView === 'history') return historicalSorted;
        if (timelineView === 'future') return futureReservations;
        return reservations || [];
    }, [timelineView, historicalSorted, futureReservations, reservations]);

    const columnHelper = useMemo(() => createColumnHelper(), []);
    const adminTableColumns = useMemo(
        () => [
            columnHelper.accessor((row) => dayjs(row?.start_time).valueOf(), {
                id: 'fecha',
                header: 'Fecha',
                cell: ({ row }) =>
                    dayjs(row.original?.start_time).isValid()
                        ? dayjs(row.original.start_time).format('DD MMM YYYY, h:mm A')
                        : '—',
            }),
            columnHelper.accessor((row) => row?.amenity?.name || '—', {
                id: 'amenidad',
                header: 'Amenidad',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2 min-w-0">
                        {getAmenityIcon(
                            row.original?.amenity?.icon,
                            'text-default-400 text-base shrink-0',
                        )}
                        <span className="truncate">{row.original?.amenity?.name || '—'}</span>
                    </div>
                ),
            }),
            columnHelper.accessor((row) => unitLabelById.get(String(row?.unit_id)) || '—', {
                id: 'unidad',
                header: 'Unidad',
            }),
            columnHelper.accessor('status', {
                id: 'estado',
                header: 'Estado',
                cell: ({ row }) => {
                    const status = String(row.original?.status || '').toLowerCase();
                    const config =
                        status === 'confirmed'
                            ? { color: 'success', label: 'Confirmada' }
                            : status === 'pending'
                              ? { color: 'warning', label: 'Pendiente' }
                              : status === 'cancelled' || status === 'canceled'
                                ? { color: 'danger', label: 'Cancelada' }
                                : { color: 'default', label: row.original?.status || '—' };
                    return (
                        <Chip size="sm" color={config.color} variant="flat">
                            {config.label}
                        </Chip>
                    );
                },
            }),
        ],
        [columnHelper, unitLabelById],
    );
    const pendingCount = useMemo(
        () =>
            visibleReservations.filter((r) => String(r?.status || '').toLowerCase() === 'pending')
                .length,
        [visibleReservations],
    );

    // ── Admin view ─────────────────────────────────────────────────────────────
    if (isAdmin) {
        return (
            <AppLayout>
                <PageLayout
                    title="Reservas"
                    description="Gestión de reservas del condominio"
                    maxW="6xl"
                    backBtn
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <TimelineFilter value={timelineView} onChange={handleTimelineChange} />
                        <AdminViewToggle value={adminViewMode} onChange={setAdminViewMode} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl border border-default-200">
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
                            <SelectItem key="all" value="all">
                                Todas
                            </SelectItem>
                            {amenityOptions.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                    <div className="flex items-center gap-2">
                                        {getAmenityIcon(
                                            amenities.find((a) => String(a.id) === o.key)?.icon,
                                            'text-default-400 text-base shrink-0',
                                        )}
                                        <span>{o.label}</span>
                                    </div>
                                </SelectItem>
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
                            <SelectItem key="all" value="all">
                                Todos
                            </SelectItem>
                            {statusOptions.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                    <Chip size="sm" color={o.color} variant="flat">
                                        {o.label}
                                    </Chip>
                                </SelectItem>
                            ))}
                        </Select>
                        <Select
                            variant="bordered"
                            size="sm"
                            label="Unidad"
                            selectedKeys={[selectedUnit]}
                            onSelectionChange={(keys) =>
                                setSelectedUnit(String(Array.from(keys)[0] || 'all'))
                            }
                            className="max-w-[220px]"
                        >
                            <SelectItem key="all" value="all">
                                Todas
                            </SelectItem>
                            {unitOptions.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>

                    {isLoading ? (
                        <ListSkeleton />
                    ) : adminViewMode === 'calendar' ? (
                        <ReservationCalendar
                            availability={{}}
                            userLimitByDate={{}}
                            reservationsByDate={reservationsByDate}
                            allowSelection={false}
                            showAvailability={false}
                            showReservationsAlways
                            unitLabelById={unitLabelById}
                            initialView="month"
                            reservationCardProps={{ canManage: isAdmin, condoId }}
                        />
                    ) : adminTableData.length > 0 ? (
                        <DataGrid
                            data={adminTableData}
                            columns={adminTableColumns}
                            pageSize={12}
                            onRowClick={(reservation) => {
                                setTableDetailReservation(reservation);
                                setIsTableDetailOpen(true);
                            }}
                            options={{
                                initialState: {
                                    sorting: [{ id: 'fecha', desc: true }],
                                },
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center py-14 gap-3 rounded-xl border border-dashed border-default-200">
                            <RiCalendarEventLine className="text-default-300 text-4xl" />
                            <div className="text-sm font-medium text-default-500">
                                {timelineView === 'history'
                                    ? 'No hay reservas en el historial'
                                    : timelineView === 'all'
                                      ? 'No hay reservaciones'
                                      : 'No hay reservas próximas'}
                            </div>
                        </div>
                    )}
                    <ReservationDetailsDrawer
                        key={tableDetailReservation?.id || 'table-details'}
                        isOpen={isTableDetailOpen}
                        onOpenChange={(open) => {
                            setIsTableDetailOpen(open);
                            if (!open) setTableDetailReservation(null);
                        }}
                        reservation={tableDetailReservation}
                        amenityName={tableDetailReservation?.amenity?.name}
                        amenityIcon={tableDetailReservation?.amenity?.icon}
                        unitLabel={
                            unitLabelById.get(String(tableDetailReservation?.unit_id)) || ''
                        }
                        canManage
                        condoId={condoId}
                        currentUserId={currentUser?.id}
                    />
                </PageLayout>
            </AppLayout>
        );
    }

    // ── User view ──────────────────────────────────────────────────────────────
    return (
        <AppLayout>
            <PageLayout
                title="Mis Reservas"
                description=""
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
                        <div className="mb-3">
                            <TimelineFilter value={timelineView} onChange={handleTimelineChange} />
                        </div>

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
                                        condoId={condoId}
                                        currentUserId={currentUser?.id}
                                    />
                                ))}
                            </div>
                        ))}
                        {timelineView === 'history' && totalHistoryPages > 1 && (
                            <div className="pt-3 flex justify-center">
                                <Pagination
                                    total={totalHistoryPages}
                                    page={safeHistoryPage}
                                    onChange={setHistoryPage}
                                    showControls
                                    size="sm"
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-14 gap-3 rounded-xl border border-dashed border-default-200">
                        <TimelineFilter value={timelineView} onChange={handleTimelineChange} />
                        <RiCalendarEventLine className="text-default-300 text-4xl" />
                        <div className="text-sm font-medium text-default-500">
                            {timelineView === 'history'
                                ? 'No tienes reservas en el historial'
                                : timelineView === 'all'
                                  ? 'No tienes reservaciones'
                                  : 'No tienes reservas próximas'}
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
