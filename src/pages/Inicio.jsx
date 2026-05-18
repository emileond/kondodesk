import { Badge, Button, Card, CardBody, CardHeader, Chip, Skeleton } from '@heroui/react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import { useMemo } from 'react';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import NoteCard from '../components/notes/NoteCard.jsx';
import { RiAddLine, RiCalendarEventLine, RiMegaphoneLine, RiAlertLine } from 'react-icons/ri';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds } from '../hooks/react-query/units/useUnits.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useNotes } from '../hooks/react-query/notes/useNotes.js';
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
    const { data: unitIds = [] } = useCondoMemberUnitIds(currentWorkspace, currentUser);

    const notesFromISO = useMemo(
        () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        [],
    );
    const { data: announcements = [], isLoading: notesLoading } = useNotes(currentWorkspace, {
        from: notesFromISO,
    });

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: upcomingReservations = [], isLoading: reservationsLoading } = useReservationsList({
        condo_id: currentWorkspace?.condo_id,
        unit_ids: unitIds,
        from: fromISO,
    });

    const agendaGroups = useMemo(
        () => groupReservations(upcomingReservations),
        [upcomingReservations],
    );

    const pendingCount = useMemo(
        () => upcomingReservations.filter((r) => String(r?.status || '').toLowerCase() === 'pending').length,
        [upcomingReservations],
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
                                            <NoteCard
                                                note={a}
                                                currentWorkspace={currentWorkspace}
                                                canEdit={false}
                                            />
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
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    title="Aún no tienes reservas"
                                    description="Reserva amenidades como el gimnasio, la terraza o la cancha de pádel."
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
