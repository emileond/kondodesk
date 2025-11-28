import { Card, CardBody, CardHeader, Button, Divider } from '@heroui/react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';

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

function MisReservasPage() {
    // Placeholder data: replace with real hooks/services when available
    const upcomingReservations = [];

    return (
        <AppLayout>
            <PageLayout title="Mis Reservas" description="Tus próximas reservas" maxW="4xl" backBtn>
                <Card className="bg-content1 border border-default-100">
                    <CardHeader className="text-default-600 font-semibold">
                        Próximas reservas
                    </CardHeader>
                    <Divider />
                    <CardBody>
                        {upcomingReservations.length > 0 ? (
                            <ul className="flex flex-col gap-3">
                                {upcomingReservations.map((r, i) => (
                                    <li
                                        key={i}
                                        className="p-3 rounded-medium bg-content2 border border-default-100"
                                    >
                                        <div className="text-small font-medium">{r.title}</div>
                                        <div className="text-tiny text-default-500 mt-1">
                                            {r.when}
                                        </div>
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
