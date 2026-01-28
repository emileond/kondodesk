import { Card, CardBody, CardHeader, Button, Divider } from '@heroui/react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import { useMemo } from 'react';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import NoteCard from '../components/notes/NoteCard.jsx';

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

import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds } from '../hooks/react-query/units/useUnits.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useNotes } from '../hooks/react-query/notes/useNotes.js';
import dayjs from 'dayjs';
import { RiCalendarEventLine, RiMegaphoneLine } from 'react-icons/ri';

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

    const { data: upcomingReservations = [], reservationsLoading } = useReservationsList({
        condo_id: currentWorkspace?.condo_id,
        unit_ids: unitIds,
        from: fromISO,
    });

    return (
        <AppLayout>
            <PageLayout title="Inicio" description="Resumen de tu actividad" maxW="5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Avisos */}
                    <Card className="bg-content2">
                        <CardHeader className="text-default-600 font-semibold">
                            <RiMegaphoneLine className="mr-2 text-lg" /> Avisos
                        </CardHeader>
                        <CardBody className="max-sm:max-h-[70vh] max-sm:overflow-y-auto">
                            {notesLoading ? (
                                <div className="text-sm text-default-500">Cargando…</div>
                            ) : announcements.length > 0 ? (
                                <ul className="flex flex-col gap-3">
                                    {announcements.map((a, i) => (
                                        <li
                                            key={a?.id || i}
                                            className="rounded-medium"
                                        >
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

                    {/* Mis reservas */}
                    <Card>
                        <CardHeader className="text-default-600 font-semibold">
                            <RiCalendarEventLine className="mr-2 text-lg" />
                            Próximas Reservas
                        </CardHeader>
                        <CardBody className="max-sm:max-h-[70vh] max-sm:overflow-y-auto">
                            {reservationsLoading ? (
                                <div className="text-sm text-default-500">Cargando…</div>
                            ) : upcomingReservations.length > 0 ? (
                                <ul className="flex flex-col gap-3">
                                    {upcomingReservations.map((r, i) => (
                                        <li key={r?.id || i}>
                                            <ReservationCard
                                                reservation={r}
                                                amenityName={r?.amenity?.name}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState
                                    title="Aún no tienes reservas"
                                    description="Reserva amenidades como el gimnasio, la terraza o la cancha de pádel."
                                    cta={
                                        <Button
                                            as={Link}
                                            to="/amenidades"
                                            color="primary"
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
