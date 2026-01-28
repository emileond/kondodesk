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
    const isPending = status === 'pending';

    // Try to compute human labels if date/time provided in state
    const dateStr = state?.date
        ? dayjs(state.date).format('DD MMM YYYY')
        : reservation
          ? dayjs(reservation.start_time).format('DD MMM YYYY')
          : null;

    function formatTimeIntl(hour, minute) {
        const dt = new Date(2000, 0, 1, hour, minute, 0, 0);
        return new Intl.DateTimeFormat('es-MX', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(dt);
    }

    function computeRange() {
        // Prefer payload date + time + duration
        if (state?.date && state?.time) {
            const isExclusive =
                state?.amenity_is_exclusive ??
                (Number(state?.amenity_max_capacity) === 1 ||
                Number(reservation?.amenity?.max_capacity) === 1);
            if (isExclusive && state?.rule_open_time && state?.rule_close_time) {
                const [oh, om] = String(state.rule_open_time)
                    .slice(0, 5)
                    .split(':')
                    .map((v) => parseInt(v || '0', 10));
                const [ch, cm] = String(state.rule_close_time)
                    .slice(0, 5)
                    .split(':')
                    .map((v) => parseInt(v || '0', 10));
                return `${formatTimeIntl(oh, om)}-${formatTimeIntl(ch, cm)}`;
            }
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
            return `${formatTimeIntl(start.hour(), start.minute())}-${formatTimeIntl(
                end.hour(),
                end.minute(),
            )}`;
        }
        // Fallback to reservation times
        if (reservation?.start_time) {
            const start = dayjs(reservation.start_time);
            const end = reservation?.end_time
                ? dayjs(reservation.end_time)
                : start.add(Number(reservation?.reservation_duration_minutes || 60), 'minute');
            return `${formatTimeIntl(start.hour(), start.minute())}-${formatTimeIntl(
                end.hour(),
                end.minute(),
            )}`;
        }
        return null;
    }

    const horaLabel = computeRange();

    return (
        <AppLayout>
            <PageLayout
                title="¡Tu reserva está lista!"
                description={
                    isPending
                        ? 'Tu reserva está creada, pero el pago sigue pendiente.'
                        : 'Hemos guardado los detalles de tu reserva.'
                }
                maxW="3xl"
            >
                <div className="flex flex-col gap-6">
                    <Card className="overflow-hidden">
                        <CardBody className="flex flex-col items-center text-center gap-4 py-8">
                            <div className="h-52">
                                <DotLottieReact
                                    src={isPending ? '/lottie/clock.lottie' : '/lottie/done.lottie'}
                                    autoplay
                                />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-semibold">¡Reserva completada!</h3>
                                {isPending ? (
                                    <div className="rounded-medium border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                                        El pago de esta reserva sigue pendiente. Te avisaremos
                                        cuando se confirme.
                                    </div>
                                ) : (
                                    <p className="text-default-500">
                                        Tu reserva fue creada correctamente.
                                    </p>
                                )}
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
                                        rangeLabel={horaLabel}
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
