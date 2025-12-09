import { useMemo, useState } from 'react';
import { Button, Card, CardBody } from '@heroui/react';
import dayjs from 'dayjs';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// availability: Record<string, string[]> where key = 'YYYY-MM-DD', values = ['09:00', '09:30', ...]
// onSelect({ date, time })
// onConfirm({ date, time })
function ReservationCalendar({
    availability = {},
    onSelect,
    onConfirm,
    amenityName,
    onCancelSelection,
    slotDurationByDow = {}, // map: 0..6 -> minutes
}) {
    // Views: 'day' | 'month' (default to 'day' per request)
    const [view, setView] = useState('day');
    const [monthCursor, setMonthCursor] = useState(dayjs().startOf('month'));
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [selected, setSelected] = useState(null); // {date, time}
    // Mode switches between browsing slots and confirming a chosen slot
    const [mode, setMode] = useState('browse'); // 'browse' | 'confirm'

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
        // chunk by 7
        const chunks = [];
        for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
        return chunks;
    }, [monthCursor]);

    function isSame(dateA, dateB) {
        return dayjs(dateA).isSame(dayjs(dateB), 'day');
    }

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function handleSelect(dateStr, time) {
        const sel = { date: dateStr, time };
        setSelected(sel);
        onSelect?.(sel);
        setMode('confirm');
    }

    // Helpers for day navigation
    function goToToday() {
        const today = dayjs();
        setSelectedDate(today.format('YYYY-MM-DD'));
        setMonthCursor(today.startOf('month'));
    }

    function changeDay(delta) {
        const next = dayjs(selectedDate).add(delta, 'day');
        setSelectedDate(next.format('YYYY-MM-DD'));
        setMonthCursor(next.startOf('month'));
    }

    // UI pieces
    const DayToolbar = (
        <div className="flex items-center gap-2">
            <Button size="sm" variant="light" onPress={() => changeDay(-1)}>
                ←
            </Button>
            <div className="font-semibold">{dayjs(selectedDate).format('DD MMM YYYY')}</div>
            <Button size="sm" variant="light" onPress={() => changeDay(1)}>
                →
            </Button>
        </div>
    );

    const MonthToolbar = (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant="flat"
                onPress={() => setMonthCursor(monthCursor.subtract(1, 'month'))}
            >
                ←
            </Button>
            <div className="font-semibold">{monthCursor.format('MMMM YYYY')}</div>
            <Button
                size="sm"
                variant="flat"
                onPress={() => setMonthCursor(monthCursor.add(1, 'month'))}
            >
                →
            </Button>
        </div>
    );

    // Day view content
    const daySlots = availability[selectedDate] || [];

    const handleConfirm = () => {
        if (!selected) return;
        onConfirm?.({ ...selected });
    };
    const handleChangeTime = () => {
        setMode('browse');
        onCancelSelection?.();
    };

    return (
        <div className="flex flex-col gap-4">
            {mode === 'confirm' ? (
                // Confirmation view replaces the calendar
                <Card className="overflow-hidden">
                    <CardBody>
                        <div className="h-64">
                            <DotLottieReact src="/lottie/done.lottie" className="w-full h-full" />
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-lg font-semibold">Confirmar reserva</h3>
                                <p className="text-sm text-default-500">
                                    Revisa los detalles y confirma tu reserva.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                {amenityName && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-default-500">Amenidad</span>
                                        <span className="font-medium">{amenityName}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-default-500">Fecha</span>
                                    <span className="font-medium">
                                        {dayjs(selected?.date).format('DD MMM YYYY')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-default-500">Hora</span>
                                    <span className="font-medium">
                                        {(() => {
                                            const start = selected?.time || '';
                                            const [sh, sm] = start
                                                .split(':')
                                                .map((v) => parseInt(v || '0', 10));
                                            const dow = dayjs(selected?.date).day();
                                            const dur = Number(slotDurationByDow[dow] || 60);
                                            const end = dayjs()
                                                .hour(sh)
                                                .minute(sm)
                                                .add(dur, 'minute');
                                            const fmt = (h, m) =>
                                                m === 0
                                                    ? String(h)
                                                    : `${h}:${String(m).padStart(2, '0')}`;
                                            const label = `${fmt(sh, sm)}-${fmt(end.hour(), end.minute())}`;
                                            return label;
                                        })()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                                <Button color="primary" onPress={handleConfirm}>
                                    Confirmar reserva
                                </Button>
                                <Button variant="flat" onPress={handleChangeTime}>
                                    Cambiar horario
                                </Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            ) : (
                <>
                    {/* Header: View toggle + toolbar + timezone */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {/* View toggle */}
                            <div className="inline-flex rounded-medium overflow-hidden border border-default-200 ">
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

                            {/* Context toolbar changes with view */}
                            {view === 'day' ? DayToolbar : MonthToolbar}
                        </div>
                    </div>

                    {/* Views */}
                    {view === 'day' ? (
                        <div>
                            {daySlots.length === 0 && (
                                <div className="text-sm text-default-500">
                                    Sin disponibilidad para este día
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3 justify-center">
                                {daySlots.map((t) => {
                                    const isSel =
                                        selected &&
                                        selected.date === selectedDate &&
                                        selected.time === t;
                                    return (
                                        <Button
                                            key={t}
                                            size="md"
                                            variant={isSel ? 'solid' : 'bordered'}
                                            color={isSel ? 'primary' : 'default'}
                                            className={`h-14 justify-start flex-1/5 hover:bg-default-100 font-medium ${isSel && 'hover:bg-primary'}`}
                                            onPress={() => handleSelect(selectedDate, t)}
                                        >
                                            {t}
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
                                                const slots = availability[dateStr] || [];
                                                const isToday = isSame(d, dayjs());
                                                const inMonth = d.month() === monthCursor.month();
                                                const hasAvail = slots.length > 0;
                                                return (
                                                    <div
                                                        key={dateStr}
                                                        className={`bg-content1 p-2 h-30 flex flex-col mb-px ${isToday && 'bg-primary-50 overflow-auto'}`}
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
                                                        {/* Slots */}
                                                        <div className="overflow-auto flex flex-wrap gap-0.5 ">
                                                            {!hasAvail && (
                                                                <span className="text-xs text-default-400">
                                                                    Sin disponibilidad
                                                                </span>
                                                            )}
                                                            {slots.map((t) => {
                                                                const isSel =
                                                                    selected &&
                                                                    selected.date === dateStr &&
                                                                    selected.time === t;
                                                                return (
                                                                    <Button
                                                                        key={t}
                                                                        size="sm"
                                                                        variant={
                                                                            isSel
                                                                                ? 'solid'
                                                                                : 'bordered'
                                                                        }
                                                                        color={
                                                                            isSel
                                                                                ? 'primary'
                                                                                : 'default'
                                                                        }
                                                                        className="h-7 text-xs flex-1/3"
                                                                        onPress={() =>
                                                                            handleSelect(dateStr, t)
                                                                        }
                                                                    >
                                                                        {t}
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
            )}
        </div>
    );
}

export default ReservationCalendar;
