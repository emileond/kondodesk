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

function InicioPage() {
    // Placeholder data: replace with real hooks when available
    const announcements = [];
    const upcomingReservations = [];

    return (
        <AppLayout>
            <PageLayout title="Inicio" description="Resumen de tu actividad" maxW="5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Avisos */}
                    <Card className="bg-content1 border border-default-100">
                        <CardHeader className="text-default-600 font-semibold">Avisos</CardHeader>
                        <Divider />
                        <CardBody>
                            {announcements.length > 0 ? (
                                <ul className="flex flex-col gap-3">
                                    {announcements.map((a, i) => (
                                        <li
                                            key={i}
                                            className="p-3 rounded-medium bg-content2 border border-default-100"
                                        >
                                            <div className="text-small font-medium">{a.title}</div>
                                            {a.description && (
                                                <div className="text-tiny text-default-500 mt-1">
                                                    {a.description}
                                                </div>
                                            )}
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
                    <Card className="bg-content1 border border-default-100">
                        <CardHeader className="text-default-600 font-semibold">
                            Mis reservas
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
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default InicioPage;
