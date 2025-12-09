import { Card, CardBody, CardHeader, Button, Divider } from '@heroui/react';
import { Link } from 'react-router-dom';
import { useRef, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCard from '../components/reservations/ReservationCard.jsx';

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
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import dayjs from 'dayjs';

function MisReservasPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: currentUser } = useUser();

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: reservations = [], isLoading } = useReservationsList({
        condo_id: currentWorkspace?.condo_id,
        user_id: currentUser?.id,
        from: fromISO,
    });

    const upcomingReservations = reservations;

    return (
        <AppLayout>
            <PageLayout title="Reservas" description="Tus próximas reservas" maxW="4xl" backBtn>
                <Card>
                    <CardHeader className="text-default-600 font-semibold">
                        Próximas reservas
                    </CardHeader>
                    <CardBody>
                        {isLoading ? (
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
            </PageLayout>
        </AppLayout>
    );
}

export default MisReservasPage;
