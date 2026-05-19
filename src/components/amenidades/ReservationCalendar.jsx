import { useMemo, useState } from 'react';
import {
    Button,
    Card,
    CardBody,
    Chip,
    Divider,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from '@heroui/react';
import dayjs from 'dayjs';
import {
    RiCalendarEventLine,
    RiTimeLine,
    RiMoneyDollarCircleLine,
} from 'react-icons/ri';
import ReservationCard from '../reservations/ReservationCard.jsx';
import { getAmenityIcon } from '../../utils/amenityIcon.jsx';

// availability: Record<string, string[]> where key = 'YYYY-MM-DD', values = ['09:00', '09:30', ...]
// onSelect({ date, time })
// onConfirm({ date, time })
function ReservationCalendar({
    availability = {},
    userLimitByDate = {},
    onSelect,
    onConfirm,
    amenityName,
    amenityIcon,
    costLabel,
    onCancelSelection,
    slotDurationByDow = {}, // map: 0..6 -> minutes
    ruleByDow = {},
    reservationsByDate = {},
    amenityMaxCapacity = null,
    showAvailability = true,
    allowSelection = true,
    showReservationsAlways = false,
    onReservationPress,
    reservationLabelFormatter,
    reservationCardProps = {},
    unitLabelById,
    initialView = 'day',
}) {
    const [view, setView] = useState(initialView === 'month' ? 'month' : 'day');
    const [monthCursor, setMonthCursor] = useState(dayjs().startOf('month'));
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [selected, setSelected] = useState(null); // {date, time}
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Calendar weeks for the current month
    const weeks = useMemo(() => {
        const start = monthCursor.startOf('week');
        const end = monthCursor.endOf('month').endOf('week');
        const days = [];
        let d = start;
        while (d.isBefore(end) || d.isSame(end, 'day')) {
            days.push(d);
            d = d.add(1, 'day');
        }
        const chunks = [];
        for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
        return chunks;
    }, [monthCursor]);

    function isSame(dateA, dateB) {
        return dayjs(dateA).isSame(dayjs(dateB), 'day');
    }

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function formatTimeIntl(hour, minute) {
        const dt = new Date(2000, 0, 1, hour, minute, 0, 0);
        return new Intl.DateTimeFormat('es-MX', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(dt);
    }

    function formatReservationRange(reservation) {
        const start = dayjs(reservation?.start_time);
        if (!start.isValid()) return '';
        let end = reservation?.end_time ? dayjs(reservation.end_time) : null;
        if (!end && Number.isFinite(Number(reservation?.reservation_duration_minutes))) {
            end = start.add(Number(reservation.reservation_duration_minutes), 'minute');
        }
        const from = start.format('HH:mm');
        const to = end && end.isValid() ? end.format('HH:mm') : '';
        return to ? `${from}-${to}` : from;
    }

    function formatReservationStart(reservation) {
        const start = dayjs(reservation?.start_time);
        if (!start.isValid()) return '';
        return start.format('HH:mm');
    }

    // Returns { start, end } labels for a slot given date + time string
    function computeSlotLabels(dateStr, t) {
        const [sh, sm] = t.split(':').map((v) => parseInt(v || '0', 10));
        const dow = dayjs(dateStr).day();
        const rule = ruleByDow[dow];
        const isExcl = Number(amenityMaxCapacity) === 1;
        if (isExcl && rule?.open_time && rule?.close_time) {
            const [oh, om] = String(rule.open_time)
                .slice(0, 5)
                .split(':')
                .map((v) => parseInt(v || '0', 10));
            const [ch, cm] = String(rule.close_time)
                .slice(0, 5)
                .split(':')
                .map((v) => parseInt(v || '0', 10));
            return { start: formatTimeIntl(oh, om), end: formatTimeIntl(ch, cm) };
        }
        const dur = Number(slotDurationByDow[dow] || 60);
        const endD = dayjs().hour(sh).minute(sm).add(dur, 'minute');
        return { start: formatTimeIntl(sh, sm), end: formatTimeIntl(endD.hour(), endD.minute()) };
    }

    function handleSelect(dateStr, time) {
        if (!allowSelection) return;
        const sel = { date: dateStr, time };
        setSelected(sel);
        onSelect?.(sel);
        setConfirmOpen(true);
    }

    function changeDay(delta) {
        const next = dayjs(selectedDate).add(delta, 'day');
        setSelectedDate(next.format('YYYY-MM-DD'));
        setMonthCursor(next.startOf('month'));
    }

    const handleConfirm = () => {
        if (!selected) return;
        setConfirmOpen(false);
        onConfirm?.({ ...selected });
    };

    const handleChangeTime = () => {
        setConfirmOpen(false);
        setSelected(null);
        onCancelSelection?.();
    };

    // Compute confirm modal labels
    const confirmLabels = selected ? computeSlotLabels(selected.date, selected.time) : null;

    // Day view content — deduplicate slots (backend may return the same time multiple times for capacity)
    const daySlots = [...new Set(availability[selectedDate] || [])];
    const dayReservations = reservationsByDate[selectedDate] || [];
    const hasDailyLimit = !!userLimitByDate[selectedDate];
    const showReservedSlots = hasDailyLimit && dayReservations.length > 0;
    const showReservations = showReservationsAlways
        ? dayReservations.length > 0
        : showReservedSlots;
    const isExclusive = Number(amenityMaxCapacity) === 1;

    // Toolbar pieces
    const DayToolbar = (
        <div className="flex items-center gap-1">
            <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => changeDay(-1)}
                aria-label="Día anterior"
            >
                ←
            </Button>
            <div className="font-semibold text-sm min-w-[130px] text-center">
                {dayjs(selectedDate).isSame(dayjs(), 'day')
                    ? 'Hoy · ' + dayjs(selectedDate).format('DD MMM')
                    : dayjs(selectedDate).isSame(dayjs().add(1, 'day'), 'day')
                      ? 'Mañana · ' + dayjs(selectedDate).format('DD MMM')
                      : dayjs(selectedDate).format('DD MMM YYYY')}
            </div>
            <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => changeDay(1)}
                aria-label="Día siguiente"
            >
                →
            </Button>
        </div>
    );

    const MonthToolbar = (
        <div className="flex items-center gap-1">
            <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => setMonthCursor(monthCursor.subtract(1, 'month'))}
                aria-label="Mes anterior"
            >
                ←
            </Button>
            <div className="font-semibold text-sm min-w-[120px] text-center capitalize">
                {monthCursor.format('MMMM YYYY')}
            </div>
            <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => setMonthCursor(monthCursor.add(1, 'month'))}
                aria-label="Mes siguiente"
            >
                →
            </Button>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Confirmation modal — rendered outside browse wrapper so calendar stays mounted */}
            {allowSelection && (
                <Modal
                    isOpen={confirmOpen}
                    onOpenChange={(open) => {
                        if (!open) handleChangeTime();
                    }}
                    size="2xl"
                    scrollBehavior="inside"
                >
                    <ModalContent>
                        <ModalHeader className="flex flex-col gap-0.5 pb-1">
                            <span className="text-lg font-bold">Confirmar reserva</span>
                            <span className="text-sm font-normal text-default-500">
                                Revisa los detalles antes de continuar.
                            </span>
                        </ModalHeader>
                        <ModalBody className="gap-4 py-4">
                            {/* Summary card */}
                            <div className="rounded-xl border border-default-200 overflow-hidden">
                                {/* Amenity header row */}
                                {amenityName && (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-content2">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-100 shrink-0">
                                            {getAmenityIcon(amenityIcon, 'text-primary-600 text-lg')}
                                        </div>
                                        <div>
                                            <div className="text-xs text-default-400 font-medium uppercase tracking-wide">
                                                Amenidad
                                            </div>
                                            <div className="text-base font-semibold text-default-800">
                                                {amenityName}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <Divider />
                                {/* Date + time rows */}
                                <div className="grid grid-cols-2 divide-x divide-default-100">
                                    <div className="flex flex-col items-center gap-1 px-4 py-4">
                                        <RiCalendarEventLine className="text-default-400 text-xl mb-0.5" />
                                        <div className="text-xs text-default-400 font-medium uppercase tracking-wide">
                                            Fecha
                                        </div>
                                        <div className="text-sm font-bold text-default-800 text-center capitalize">
                                            {selected
                                                ? dayjs(selected.date).format('ddd D [de] MMM')
                                                : '—'}
                                        </div>
                                        <div className="text-xs text-default-400">
                                            {selected ? dayjs(selected.date).format('YYYY') : ''}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 px-4 py-4">
                                        <RiTimeLine className="text-default-400 text-xl mb-0.5" />
                                        <div className="text-xs text-default-400 font-medium uppercase tracking-wide">
                                            Horario
                                        </div>
                                        <div className="text-sm font-bold text-default-800">
                                            {confirmLabels?.start ?? '—'}
                                        </div>
                                        <div className="text-xs text-default-400">
                                            a {confirmLabels?.end ?? '—'}
                                        </div>
                                    </div>
                                </div>
                                {/* Cost row (only if applicable) */}
                                {typeof costLabel !== 'undefined' && costLabel !== null && (
                                    <>
                                        <Divider />
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <div className="flex items-center gap-2 text-default-500 text-sm">
                                                <RiMoneyDollarCircleLine className="text-success-500 text-lg" />
                                                Costo de la reserva
                                            </div>
                                            <Chip
                                                color="success"
                                                variant="flat"
                                                size="sm"
                                                className="font-semibold"
                                            >
                                                {costLabel}
                                            </Chip>
                                        </div>
                                    </>
                                )}
                            </div>
                            {costLabel && (
                                <p className="text-xs text-default-400 text-center -mt-1">
                                    El pago se coordina con el administrador del condominio.
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter className="flex flex-col gap-2 pt-0 pb-4 px-4">
                            <Button
                                color="primary"
                                onPress={handleConfirm}
                                className="w-full font-semibold"
                                size="lg"
                            >
                                Confirmar reserva
                            </Button>
                            <Button
                                variant="flat"
                                onPress={handleChangeTime}
                                className="w-full"
                                size="lg"
                            >
                                Cancelar
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}

            {/* Calendar always stays mounted so slots don't disappear behind the modal */}
            <>
                {/* Header: View toggle + toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex rounded-medium overflow-hidden border border-default-200">
                            <Button
                                size="sm"
                                variant={view === 'day' ? 'solid' : 'light'}
                                color={view === 'day' ? 'primary' : 'default'}
                                className="rounded-none"
                                onPress={() => setView('day')}
                            >
                                Día
                            </Button>
                            <Button
                                size="sm"
                                variant={view === 'month' ? 'solid' : 'light'}
                                color={view === 'month' ? 'primary' : 'default'}
                                className="rounded-none"
                                onPress={() => setView('month')}
                            >
                                Mes
                            </Button>
                        </div>
                        {view === 'day' ? DayToolbar : MonthToolbar}
                    </div>
                </div>

                {/* Views */}
                {view === 'day' ? (
                    <div>
                        {hasDailyLimit && (
                            <div
                                role="alert"
                                className="mb-3 rounded-medium border border-warning-200 bg-warning-50 text-warning-700 px-3 py-2 text-sm"
                            >
                                Has alcanzado tu límite de reservas para este día.
                            </div>
                        )}
                        {showReservedSlots && (
                            <div className="mb-2 text-xs font-semibold text-default-400 uppercase tracking-wide">
                                Tus reservas para este día
                            </div>
                        )}
                        {showReservationsAlways && dayReservations.length > 0 && (
                            <div className="mb-2 text-xs font-semibold text-default-400 uppercase tracking-wide">
                                Reservas para este día
                            </div>
                        )}
                        {showReservationsAlways && dayReservations.length === 0 && (
                            <div className="text-sm text-default-400 text-center py-6">
                                Sin reservas para este día
                            </div>
                        )}
                        {!showReservations && showAvailability && daySlots.length === 0 && (
                            <div className="text-sm text-default-400 text-center py-8">
                                Sin disponibilidad para este día
                            </div>
                        )}
                        <div
                            className={
                                showReservations
                                    ? 'flex flex-col gap-2'
                                    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
                            }
                        >
                            {showReservations
                                ? dayReservations.map((reservation) => {
                                      const key =
                                          reservation?.id ||
                                          reservation?.start_time ||
                                          formatReservationRange(reservation);
                                      const unitLabel = unitLabelById?.get?.(
                                          String(reservation?.unit_id),
                                      );
                                      return (
                                          <ReservationCard
                                              key={key}
                                              reservation={reservation}
                                              amenityName={reservation?.amenity?.name}
                                              amenityIcon={reservation?.amenity?.icon}
                                              rangeLabel={reservationLabelFormatter?.(reservation)}
                                              unitLabel={unitLabel}
                                              showStatus
                                              className="w-full"
                                              {...reservationCardProps}
                                              onPress={
                                                  onReservationPress
                                                      ? () => onReservationPress(reservation)
                                                      : undefined
                                              }
                                          />
                                      );
                                  })
                                : showAvailability &&
                                  daySlots.map((t) => {
                                      const isSel =
                                          selected &&
                                          selected.date === selectedDate &&
                                          selected.time === t;
                                      const limited = hasDailyLimit;
                                      const labels = computeSlotLabels(selectedDate, t);
                                      return (
                                          <Button
                                              key={t}
                                              size="md"
                                              variant={
                                                  isSel ? 'solid' : limited ? 'flat' : 'bordered'
                                              }
                                              color={isSel ? 'primary' : 'default'}
                                              isDisabled={limited}
                                              className={`h-14 w-full font-medium flex flex-col items-start justify-center px-3 gap-0 ${!isSel && !limited ? 'hover:border-primary hover:text-primary' : ''}`}
                                              onPress={() => handleSelect(selectedDate, t)}
                                          >
                                              <span className="text-sm font-semibold leading-tight">
                                                  {labels.start}
                                              </span>
                                              <span
                                                  className={`text-xs leading-tight ${isSel ? 'text-primary-200' : 'text-default-400'}`}
                                              >
                                                  a {labels.end}
                                              </span>
                                          </Button>
                                      );
                                  })}
                        </div>
                    </div>
                ) : (
                    <Card shadow="sm">
                        <CardBody className="p-0">
                            {/* Header days */}
                            <div className="grid grid-cols-7 text-xs font-medium text-default-500 py-2 border-b-1 border-default-200">
                                {dayNames.map((n) => (
                                    <div key={n} className="text-center">
                                        {n}
                                    </div>
                                ))}
                            </div>
                            <div className="grid auto-rows-min gap-px">
                                {weeks.map((week, wi) => (
                                    <div
                                        key={wi}
                                        className="grid grid-cols-7 gap-px bg-default-200"
                                    >
                                        {week.map((d) => {
                                            const dateStr = d.format('YYYY-MM-DD');
                                            const slots = [...new Set(availability[dateStr] || [])];
                                            const reservations = reservationsByDate[dateStr] || [];
                                            const isToday = isSame(d, dayjs());
                                            const inMonth = d.month() === monthCursor.month();
                                            const hasAvail = slots.length > 0;
                                            const limited = !!userLimitByDate[dateStr];
                                            const showReserved = showReservationsAlways
                                                ? reservations.length > 0
                                                : limited && reservations.length > 0;
                                            return (
                                                <div
                                                    key={dateStr}
                                                    className={`bg-content1 p-2 h-30 flex flex-col mb-px ${isToday ? 'bg-primary-50 overflow-auto' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            className={`text-left text-xs ${inMonth ? 'text-default-700' : 'text-default-400'} hover:underline`}
                                                            onClick={() => {
                                                                setSelectedDate(dateStr);
                                                                setView('day');
                                                            }}
                                                        >
                                                            {d.format('D')}
                                                        </button>
                                                        {isToday && (
                                                            <span className="text-xs px-1 rounded bg-primary-100 text-primary-700">
                                                                Hoy
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="overflow-auto flex flex-col gap-1">
                                                        {!showReserved &&
                                                            showAvailability &&
                                                            !hasAvail && (
                                                                <span className="text-xs text-default-400">
                                                                    Sin disponibilidad
                                                                </span>
                                                            )}
                                                        {showReserved
                                                            ? reservations.map((reservation) => {
                                                                  const label =
                                                                      formatReservationStart(
                                                                          reservation,
                                                                      );
                                                                  const key =
                                                                      reservation?.id ||
                                                                      reservation?.start_time ||
                                                                      label;
                                                                  const unitLabel =
                                                                      unitLabelById?.get?.(
                                                                          String(
                                                                              reservation?.unit_id,
                                                                          ),
                                                                      );
                                                                  return (
                                                                      <ReservationCard
                                                                          key={key}
                                                                          reservation={reservation}
                                                                          amenityName={
                                                                              reservation?.amenity
                                                                                  ?.name
                                                                          }
                                                                          amenityIcon={
                                                                              reservation?.amenity
                                                                                  ?.icon
                                                                          }
                                                                          rangeLabel={label}
                                                                          dateLabel={label}
                                                                          unitLabel={unitLabel}
                                                                          showStatus
                                                                          variant="calendar"
                                                                          {...reservationCardProps}
                                                                          onPress={
                                                                              onReservationPress
                                                                                  ? () =>
                                                                                        onReservationPress(
                                                                                            reservation,
                                                                                        )
                                                                                  : undefined
                                                                          }
                                                                      />
                                                                  );
                                                              })
                                                            : showAvailability &&
                                                              slots.map((t) => {
                                                                  const isSel =
                                                                      selected &&
                                                                      selected.date === dateStr &&
                                                                      selected.time === t;
                                                                  const slotLabels =
                                                                      computeSlotLabels(dateStr, t);
                                                                  return (
                                                                      <Button
                                                                          key={t}
                                                                          size="sm"
                                                                          variant={
                                                                              isSel
                                                                                  ? 'solid'
                                                                                  : limited
                                                                                    ? 'solid'
                                                                                    : 'bordered'
                                                                          }
                                                                          color={
                                                                              isSel
                                                                                  ? 'primary'
                                                                                  : 'default'
                                                                          }
                                                                          isDisabled={limited}
                                                                          className="h-auto py-0.5 text-xs w-full justify-start flex flex-col items-start gap-0"
                                                                          onPress={() =>
                                                                              handleSelect(
                                                                                  dateStr,
                                                                                  t,
                                                                              )
                                                                          }
                                                                      >
                                                                          <span className="font-semibold leading-tight">
                                                                              {slotLabels.start}
                                                                          </span>
                                                                          <span
                                                                              className={`leading-tight ${isSel ? 'text-primary-200' : 'text-default-400'}`}
                                                                              style={{
                                                                                  fontSize: '10px',
                                                                              }}
                                                                          >
                                                                              {slotLabels.end}
                                                                          </span>
                                                                      </Button>
                                                                  );
                                                              })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </>
        </div>
    );
}

export default ReservationCalendar;
