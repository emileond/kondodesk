import { Button, Card, CardBody } from '@heroui/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import dayjs from 'dayjs';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCard from '../components/reservations/ReservationCard.jsx';

function ReservaConfirmacionPage() {
    const location = useLocation();
    const state = location?.state || {};

    const reservation = state?.reservation || null;
    const amenityName = state?.amenityName || reservation?.amenity?.name || 'Amenidad';
    const status = (state?.status || reservation?.status || '').toLowerCase();

    // Try to compute human labels if date/time provided in state
    const dateStr = state?.date
        ? dayjs(state.date).format('DD MMM YYYY')
        : reservation
          ? dayjs(reservation.start_time).format('DD MMM YYYY')
          : null;

    function computeRange() {
        // Prefer payload date + time + duration
        if (state?.date && state?.time) {
            const [sh, sm] = String(state.time || '00:00')
                .split(':')
                .map((v) => parseInt(v || '0', 10));
            const start = dayjs(state.date).hour(sh).minute(sm).second(0).millisecond(0);
            const dur = Number(
                state.reservation_duration_minutes ||
                    reservation?.reservation_duration_minutes ||
                    60,
            );
            const end = start.add(dur, 'minute');
            const fmt = (h, m) => (m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`);
            return `${fmt(start.hour(), start.minute())}-${fmt(end.hour(), end.minute())}`;
        }
        // Fallback to reservation times
        if (reservation?.start_time) {
            const start = dayjs(reservation.start_time);
            const end = reservation?.end_time
                ? dayjs(reservation.end_time)
                : start.add(Number(reservation?.reservation_duration_minutes || 60), 'minute');
            return `${start.format('HH:mm')}-${end.format('HH:mm')}`;
        }
        return null;
    }

    const horaLabel = computeRange();

    return (
        <AppLayout>
            <PageLayout
                title="¡Tu reserva está lista!"
                description={
                    status === 'pending'
                        ? 'Se creó tu reserva y está pendiente de pago.'
                        : 'Hemos guardado los detalles de tu reserva.'
                }
                maxW="3xl"
            >
                <div className="flex flex-col gap-6">
                    <Card className="overflow-hidden">
                        <CardBody className="flex flex-col items-center text-center gap-4 py-8">
                            <div className="h-52">
                                <DotLottieReact src="/lottie/done.lottie" autoplay />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-semibold">¡Reserva completada!</h3>
                                <p className="text-default-500">
                                    {status === 'pending'
                                        ? 'Tu reserva fue creada y está pendiente de pago. Te avisaremos cuando esté confirmada.'
                                        : 'Tu reserva fue creada correctamente.'}
                                </p>
                            </div>
                            {(reservation || amenityName || dateStr || horaLabel) && (
                                <div className="w-full max-w-md text-left">
                                    <ReservationCard
                                        reservation={
                                            reservation || {
                                                start_time:
                                                    state?.date && state?.time
                                                        ? dayjs(state.date)
                                                              .hour(
                                                                  parseInt(
                                                                      String(state.time).split(
                                                                          ':',
                                                                      )[0] || '0',
                                                                      10,
                                                                  ),
                                                              )
                                                              .minute(
                                                                  parseInt(
                                                                      String(state.time).split(
                                                                          ':',
                                                                      )[1] || '0',
                                                                      10,
                                                                  ),
                                                              )
                                                              .second(0)
                                                              .millisecond(0)
                                                              .toISOString()
                                                        : null,
                                                end_time: null,
                                                reservation_duration_minutes:
                                                    state?.reservation_duration_minutes || null,
                                                status: status || 'confirmed',
                                            }
                                        }
                                        amenityName={amenityName}
                                    />
                                </div>
                            )}
                            <div className="pt-2">
                                <Button as={RouterLink} to="/inicio" color="primary">
                                    Ir al inicio
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default ReservaConfirmacionPage;
