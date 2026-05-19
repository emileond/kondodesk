import { Button, Card, CardBody, CardHeader, Chip, Skeleton } from '@heroui/react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import { useMemo, useState } from 'react';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import { RiAddLine, RiCalendarEventLine, RiMegaphoneLine, RiAlertLine } from 'react-icons/ri';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds } from '../hooks/react-query/units/useUnits.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useNotes } from '../hooks/react-query/notes/useNotes.js';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../lib/supabase.js';
import dayjs from 'dayjs';

function EmptyState({ title, description, cta }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <div className="text-large font-medium text-default-600">{title}</div>
            {description && (
                <div className="text-small text-default-500 max-w-md">{description}</div>
            )}
            {cta}
        </div>
    );
}

function CardSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="rounded-xl h-16 w-full" />
            ))}
        </div>
    );
}

function getAnnouncementPreview(content, max = 180) {
    if (!content) return '';

    const extractText = (node) => {
        if (!node) return '';
        if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(' ');
        if (typeof node === 'string') return node;
        if (typeof node !== 'object') return '';

        const ownText = typeof node.text === 'string' ? node.text : '';
        const childText = extractText(node.content);
        return [ownText, childText].filter(Boolean).join(' ').trim();
    };

    let parsed = content;
    if (typeof content === 'string') {
        try {
            parsed = JSON.parse(content);
        } catch {
            parsed = content;
        }
    }

    const plain = extractText(parsed)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (plain.length <= max) return plain;
    return `${plain.slice(0, max).trimEnd()}...`;
}

// Section label that looks like an agenda divider
function AgendaSection({ label, count }) {
    return (
        <div className="flex items-center gap-2 pt-1 pb-0.5">
            <span className="text-xs font-semibold text-default-400 uppercase tracking-wide shrink-0">
                {label}
            </span>
            {count != null && (
                <span className="text-[10px] font-medium text-default-300 bg-default-100 rounded-full px-1.5 py-0.5 leading-none">
                    {count}
                </span>
            )}
            <div className="flex-1 h-px bg-default-100" />
        </div>
    );
}

// Groups reservations into agenda buckets
function groupReservations(reservations) {
    const today = dayjs().startOf('day');
    const tomorrow = today.add(1, 'day');
    const endOfThisWeek = today.endOf('week');           // Sun
    const startOfNextWeek = endOfThisWeek.add(1, 'day'); // Mon
    const endOfNextWeek = startOfNextWeek.endOf('week');

    const groups = [
        { key: 'hoy',            label: 'Hoy',             items: [] },
        { key: 'manana',         label: 'Mañana',           items: [] },
        { key: 'esta_semana',    label: 'Esta semana',      items: [] },
        { key: 'proxima_semana', label: 'Próxima semana',   items: [] },
        { key: 'mas_adelante',   label: 'Más adelante',     items: [] },
    ];

    for (const r of reservations) {
        const d = dayjs(r.start_time).startOf('day');
        if (d.isSame(today, 'day')) {
            groups[0].items.push(r);
        } else if (d.isSame(tomorrow, 'day')) {
            groups[1].items.push(r);
        } else if (d.isAfter(tomorrow) && (d.isBefore(endOfThisWeek) || d.isSame(endOfThisWeek, 'day'))) {
            groups[2].items.push(r);
        } else if (d.isAfter(endOfThisWeek) && (d.isBefore(endOfNextWeek) || d.isSame(endOfNextWeek, 'day'))) {
            groups[3].items.push(r);
        } else {
            groups[4].items.push(r);
        }
    }

    return groups.filter((g) => g.items.length > 0);
}

function InicioPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: currentUser } = useUser();
    const [adminStatusFilter, setAdminStatusFilter] = useState('all');
    const { data: unitIds = [] } = useCondoMemberUnitIds(currentWorkspace, currentUser);
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

    const notesFromISO = useMemo(() => dayjs().subtract(30, 'day').toISOString(), []);
    const { data: announcements = [], isLoading: notesLoading } = useNotes(currentWorkspace, {
        from: notesFromISO,
    });

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: upcomingReservations = [], isLoading: reservationsLoading } = useReservationsList({
        condo_id: condoId,
        is_admin: isAdmin,
        unit_ids: isAdmin ? undefined : unitIds,
        from: fromISO,
    });

    const futureReservations = useMemo(
        () => (upcomingReservations || []).filter((r) => dayjs(r?.start_time).isAfter(dayjs())),
        [upcomingReservations],
    );

    const visibleFutureReservations = useMemo(() => {
        if (!isAdmin || adminStatusFilter === 'all') return futureReservations;
        return futureReservations.filter(
            (r) => String(r?.status || '').toLowerCase() === adminStatusFilter,
        );
    }, [futureReservations, isAdmin, adminStatusFilter]);

    const agendaGroups = useMemo(
        () => groupReservations(visibleFutureReservations),
        [visibleFutureReservations],
    );

    const pendingCount = useMemo(
        () =>
            visibleFutureReservations.filter(
                (r) => String(r?.status || '').toLowerCase() === 'pending',
            ).length,
        [visibleFutureReservations],
    );

    return (
        <AppLayout>
            <PageLayout title="Inicio" description="Resumen de tu actividad" maxW="5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Avisos */}
                    <Card className="bg-content2">
                        <CardHeader className="flex items-center gap-2 text-default-600 font-semibold pb-0">
                            <RiMegaphoneLine className="text-lg shrink-0" />
                            <span>Avisos</span>
                        </CardHeader>
                        <CardBody className="max-sm:max-h-[70vh] max-sm:overflow-y-auto pt-3">
                            {notesLoading ? (
                                <CardSkeleton />
                            ) : announcements.length > 0 ? (
                                <ul className="flex flex-col gap-3">
                                    {announcements.map((a, i) => (
                                        <li key={a?.id || i} className="rounded-medium">
                                            <Link
                                                to={`/notes?note=${encodeURIComponent(a?.id || '')}`}
                                            >
                                                <article className="rounded-xl border border-default-200 bg-content1 px-4 py-3 hover:bg-content2 transition-colors">
                                                    <h4 className="text-sm font-semibold text-default-800 line-clamp-1">
                                                        {a?.title || 'Aviso'}
                                                    </h4>
                                                    <p className="mt-1 text-xs text-default-500 line-clamp-3">
                                                        {getAnnouncementPreview(a?.content)}
                                                    </p>
                                                </article>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState
                                    title="No hay avisos nuevos"
                                    description="Cuando haya novedades o anuncios importantes, los verás aquí."
                                />
                            )}
                        </CardBody>
                    </Card>

                    {/* Próximas Reservas */}
                    <Card>
                        <CardHeader className="flex items-center justify-between pb-0">
                            <div className="flex items-center gap-2 text-default-600 font-semibold">
                                <RiCalendarEventLine className="text-lg shrink-0" />
                                <span>Próximas Reservas</span>
                                {pendingCount > 0 && (
                                    <Chip
                                        size="sm"
                                        color="warning"
                                        variant="flat"
                                        startContent={<RiAlertLine className="ml-1" />}
                                    >
                                        {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                                    </Chip>
                                )}
                            </div>
                            <Button
                                as={Link}
                                to="/amenidades"
                                size="sm"
                                color="primary"
                                variant="flat"
                                startContent={<RiAddLine />}
                                className="font-medium shrink-0"
                            >
                                Reservar
                            </Button>
                        </CardHeader>
                        <CardBody className="max-sm:max-h-[70vh] max-sm:overflow-y-auto pt-3">
                            {isAdmin && (
                                <div className="mb-3 inline-flex rounded-lg border border-default-200 p-1 bg-content1">
                                    {[
                                        { key: 'all', label: 'Todas' },
                                        { key: 'pending', label: 'Pendientes' },
                                        { key: 'cancelled', label: 'Canceladas' },
                                    ].map((opt) => (
                                        <Button
                                            key={opt.key}
                                            size="sm"
                                            variant={
                                                adminStatusFilter === opt.key ? 'solid' : 'light'
                                            }
                                            color={
                                                adminStatusFilter === opt.key
                                                    ? 'primary'
                                                    : 'default'
                                            }
                                            onPress={() => setAdminStatusFilter(opt.key)}
                                            className="min-w-[106px]"
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            {reservationsLoading ? (
                                <CardSkeleton />
                            ) : agendaGroups.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {/* Pending banner */}
                                    {pendingCount > 0 && (
                                        <div className="mb-2 rounded-xl bg-warning-50 border border-warning-200 px-3 py-2.5 flex items-start gap-2">
                                            <RiAlertLine className="text-warning-600 mt-0.5 shrink-0" />
                                            <p className="text-xs text-warning-700">
                                                Tienes{' '}
                                                <strong>
                                                    {pendingCount} reserva{pendingCount > 1 ? 's' : ''}
                                                </strong>{' '}
                                                pendiente{pendingCount > 1 ? 's' : ''} de pago.
                                                Contacta al administrador para confirmarlas.
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
                                                    condoId={currentWorkspace?.condo_id}
                                                    currentUserId={currentUser?.id}
                                                    canManage={isAdmin}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    title={
                                        isAdmin
                                            ? 'No hay reservas próximas'
                                            : 'Aún no tienes reservas'
                                    }
                                    description={
                                        isAdmin
                                            ? 'No hay resultados para el filtro seleccionado.'
                                            : 'Reserva amenidades como el gimnasio, la terraza o la cancha de pádel.'
                                    }
                                    cta={
                                        <Button
                                            as={Link}
                                            to="/amenidades"
                                            color="primary"
                                            startContent={<RiAddLine />}
                                            className="font-medium"
                                        >
                                            Reservar amenidades
                                        </Button>
                                    }
                                />
                            )}
                        </CardBody>
                    </Card>
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default InicioPage;
