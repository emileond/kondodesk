import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isToday from 'dayjs/plugin/isToday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import {
    RiAddLine,
    RiArrowDownSLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiCalendar2Line,
    RiCheckLine,
    RiLayoutGridLine,
    RiLayoutRowLine,
    RiMenuLine,
} from 'react-icons/ri';

// FIX: These plugins must be extended for dayjs to have the required functionality.
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isToday);
dayjs.extend(localizedFormat);
dayjs.extend(isSameOrBefore);
dayjs.tz.setDefault(dayjs.tz.guess()); // Auto-detect user's timezone

// --- MOCK DATA (Source dates are in UTC) ---
const mockEvents = [
    {
        id: 1,
        title: 'Team Standup',
        calendar: 'Work',
        start: '2025-08-06T14:00:00Z',
        end: '2025-08-06T14:30:00Z',
        color: 'blue',
    },
    {
        id: 2,
        title: 'Design Review',
        calendar: 'Work',
        start: '2025-08-06T19:00:00Z',
        end: '2025-08-06T20:00:00Z',
        color: 'blue',
    },
    {
        id: 3,
        title: 'Lunch with Sarah',
        calendar: 'Personal',
        start: '2025-08-06T17:30:00Z',
        end: '2025-08-06T18:30:00Z',
        color: 'green',
    },
    {
        id: 4,
        title: 'Frontend Sync',
        calendar: 'Work',
        start: '2025-08-08T16:00:00Z',
        end: '2025-08-08T17:00:00Z',
        color: 'blue',
    },
    {
        id: 5,
        title: 'Project Kickoff',
        calendar: 'Project X',
        start: '2025-08-11T15:00:00Z',
        end: '2025-08-11T16:30:00Z',
        color: 'violet',
    },
    {
        id: 6,
        title: 'Doctor Appointment',
        calendar: 'Personal',
        start: '2025-08-11T21:00:00Z',
        end: '2025-08-11T21:30:00Z',
        color: 'green',
    },
    {
        id: 7,
        title: 'All-day Offsite',
        calendar: 'Work',
        start: '2025-08-20T14:00:00Z',
        end: '2025-08-20T22:00:00Z',
        allDay: true,
        color: 'blue',
    },
    {
        id: 8,
        title: 'Dentist',
        calendar: 'Personal',
        start: '2025-09-02T15:00:00Z',
        end: '2025-09-02T16:00:00Z',
        color: 'green',
    },
];

const mockCalendars = [
    { id: 'Work', name: 'Work', color: 'blue', isVisible: true },
    { id: 'Personal', name: 'Personal', color: 'green', isVisible: true },
    { id: 'Project X', name: 'Project X', color: 'purple', isVisible: false },
];

// Helper to parse UTC and convert to local time
const parseToLocal = (dateStr) => dayjs.utc(dateStr).local();

// --- EventItem Component ---
const EventItem = ({ event }) => {
    const formatTime = (date) => parseToLocal(date).format('h:mm A');

    return (
        <div
            className={`w-full text-left p-1 rounded-md text-white bg-${event.color}-500 border border-${event.color}-600 hover:bg-${event.color}-600 transition-colors duration-150 cursor-pointer`}
        >
            <p className="text-xs font-semibold truncate">
                {event.allDay ? 'All-day' : `${formatTime(event.start)} - ${formatTime(event.end)}`}
            </p>
            <p className="text-sm truncate">{event.title}</p>
        </div>
    );
};

// --- Calendar Views ---
const MonthView = ({ currentDate, events, onDayClick }) => {
    const monthStart = currentDate.startOf('month');
    const monthEnd = currentDate.endOf('month');
    const startDate = monthStart.startOf('week');
    const endDate = monthEnd.endOf('week');

    const days = [];
    let day = startDate;
    while (day.isSameOrBefore(endDate)) {
        days.push(day);
        day = day.add(1, 'day');
    }

    const dayNames = days.slice(0, 7).map((d) => d.format('ddd'));

    return (
        <div className="flex-grow grid grid-cols-7 grid-rows-1 auto-rows-fr gap-px bg-gray-200 dark:bg-gray-700">
            {dayNames.map((dayName) => (
                <div
                    key={dayName}
                    className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"
                >
                    {dayName}
                </div>
            ))}
            {days.map((day) => {
                const dayEvents = events.filter((event) =>
                    parseToLocal(event.start).isSame(day, 'day'),
                );
                return (
                    <div
                        key={day.toString()}
                        onClick={() => onDayClick(day)}
                        className={`relative p-2 flex flex-col gap-1 min-h-[120px] transition-colors duration-200 cursor-pointer
                            ${day.isSame(currentDate, 'month') ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-gray-100 dark:bg-gray-900/50 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/80'}`}
                    >
                        <time
                            dateTime={day.format('YYYY-MM-DD')}
                            className={`text-sm font-medium ${day.isToday() ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : ''}`}
                        >
                            {day.format('D')}
                        </time>
                        <div className="flex flex-col gap-1 overflow-y-auto">
                            {dayEvents.slice(0, 3).map((event) => (
                                <EventItem key={event.id} event={event} />
                            ))}
                            {dayEvents.length > 3 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    + {dayEvents.length - 3} more
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const WeekView = ({ currentDate, events }) => {
    const weekStart = currentDate.startOf('week');
    const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex-grow flex flex-col">
            <div className="grid grid-cols-[auto_1fr] flex-shrink-0">
                <div className="w-16"></div> {/* Spacer for time column */}
                <div className="grid grid-cols-7">
                    {days.map((day) => (
                        <div
                            key={day.toString()}
                            className="p-2 text-center border-b border-l border-gray-200 dark:border-gray-700"
                        >
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {day.format('ddd')}
                            </p>
                            <p
                                className={`text-lg font-semibold ${day.isToday() ? 'text-blue-600' : ''}`}
                            >
                                {day.format('D')}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-[auto_1fr] h-full">
                    <div className="w-16">
                        {hours.map((hour) => (
                            <div
                                key={hour}
                                className="h-24 text-right pr-2 text-sm text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700"
                            >
                                {dayjs().hour(hour).format('hA')}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 relative">
                        {days.map((day) => (
                            <div
                                key={day.toString()}
                                className="border-l border-gray-200 dark:border-gray-700 relative"
                            >
                                {hours.map((hour) => (
                                    <div
                                        key={hour}
                                        className="h-24 border-b border-gray-200 dark:border-gray-700"
                                    ></div>
                                ))}
                                {events
                                    .filter((e) => parseToLocal(e.start).isSame(day, 'day'))
                                    .map((event) => {
                                        const start = parseToLocal(event.start);
                                        const end = parseToLocal(event.end);
                                        const top = (start.hour() + start.minute() / 60) * 6;
                                        const height = end.diff(start, 'hour', true) * 6;
                                        return (
                                            <div
                                                key={event.id}
                                                className="absolute w-full px-1"
                                                style={{ top: `${top}rem`, height: `${height}rem` }}
                                            >
                                                <EventItem event={event} />
                                            </div>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DayView = ({ currentDate, events }) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = events.filter((e) => parseToLocal(e.start).isSame(currentDate, 'day'));

    // -> 1. Ref for the scroll container
    const scrollContainerRef = useRef(null);

    // -> 2. State for the live time, to re-render the indicator
    const [currentTime, setCurrentTime] = useState(dayjs());
    const isToday = currentDate.isToday();

    // -> 3. Effect for scrolling and setting up the timer
    useEffect(() => {
        // Only run this logic if the view is for today
        if (isToday) {
            // Scroll to the current hour (minus one hour for better visibility)
            if (scrollContainerRef.current) {
                const currentHour = dayjs().hour();
                // Each hour slot is h-24 = 6rem = 96px high

                scrollContainerRef.current.scrollTop = Math.max(0, (currentHour - 1) * 96);
            }

            // Set up an interval to update the current time every minute
            const intervalId = setInterval(() => {
                setCurrentTime(dayjs());
            }, 60000); // 60,000 ms = 1 minute

            // Cleanup function to clear the interval when the component unmounts
            return () => clearInterval(intervalId);
        }
    }, [isToday]); // Rerun effect if the date changes to/from today

    // -> 4. Calculate the top position for the time indicator
    const timeIndicatorTop = (currentTime.hour() + currentTime.minute() / 60) * 6; // 6rem per hour

    return (
        // Attach the ref to the main scrollable container
        <div ref={scrollContainerRef} className="flex-grow flex flex-col overflow-y-auto">
            <div className="grid grid-cols-[auto_1fr] h-full">
                <div className="w-14 flex-shrink-0">
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            className="h-24 text-right pr-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700"
                        >
                            {dayjs().hour(hour).format('hA')}
                        </div>
                    ))}
                </div>
                <div className="relative flex-grow">
                    {/* Background Hour Slots */}
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            className="h-24 border-b border-gray-200 dark:border-gray-700"
                        ></div>
                    ))}

                    {/* -> 5. Render the Current Time Indicator */}
                    {isToday && (
                        <div
                            className="absolute left-0 right-0 flex items-center z-30"
                            style={{ top: `${timeIndicatorTop}rem` }}
                        >
                            <div className="w-2 h-2 bg-primary-600 rounded-full -ml-1"></div>
                            <div className="h-0.5 flex-grow bg-primary-600"></div>
                        </div>
                    )}

                    {/* Render Events */}
                    {dayEvents.map((event) => {
                        const start = parseToLocal(event.start);
                        const end = parseToLocal(event.end);
                        const top = (start.hour() + start.minute() / 60) * 6;
                        const height = end.diff(start, 'hour', true) * 6;
                        return (
                            <div
                                key={event.id}
                                className="absolute w-full px-1 z-20" // Add z-20 to ensure events are above the time line
                                style={{ top: `${top}rem`, height: `${height}rem` }}
                            >
                                <EventItem event={event} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const AgendaView = ({ currentDate, events }) => {
    const weekStart = currentDate.startOf('week');
    const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

    return (
        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
            {days.map((day) => {
                const dayEvents = events
                    .filter((event) => parseToLocal(event.start).isSame(day, 'day'))
                    .sort((a, b) => parseToLocal(a.start) - parseToLocal(b.start));
                if (dayEvents.length === 0) return null;

                return (
                    <div key={day.toString()}>
                        <div className="flex items-baseline gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <h3
                                className={`text-lg font-bold ${day.isToday() ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}
                            >
                                {day.format('dddd')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {day.format('MMMM D')}
                            </p>
                        </div>
                        <div className="mt-4 space-y-4">
                            {dayEvents.map((event) => (
                                <div key={event.id} className="flex items-start gap-4">
                                    <div className="w-28 flex-shrink-0 text-right">
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                                            {event.allDay
                                                ? 'All Day'
                                                : parseToLocal(event.start).format('h:mm A')}
                                        </p>
                                    </div>
                                    <div
                                        className={`w-1 self-stretch bg-${event.color}-500 rounded-full`}
                                    ></div>
                                    <div className="flex-grow">
                                        <p className="font-bold text-gray-900 dark:text-gray-100">
                                            {event.title}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {event.calendar}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// --- Main Calendar Component ---
const EventCalendar = ({ initialView = 'month', views = ['day', 'week', 'month', 'agenda'] }) => {
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [view, setView] = useState(initialView);
    const [calendars, setCalendars] = useState(mockCalendars);

    const visibleCalendars = useMemo(
        () => calendars.filter((c) => c.isVisible).map((c) => c.id),
        [calendars],
    );
    const filteredEvents = useMemo(
        () => mockEvents.filter((event) => visibleCalendars.includes(event.calendar)),
        [visibleCalendars],
    );

    const handlePrev = () => {
        if (view === 'month') setCurrentDate(currentDate.subtract(1, 'month'));
        else if (view === 'week' || view === 'agenda')
            setCurrentDate(currentDate.subtract(1, 'week'));
        else if (view === 'day') setCurrentDate(currentDate.subtract(1, 'day'));
    };

    const handleNext = () => {
        if (view === 'month') setCurrentDate(currentDate.add(1, 'month'));
        else if (view === 'week' || view === 'agenda') setCurrentDate(currentDate.add(1, 'week'));
        else if (view === 'day') setCurrentDate(currentDate.add(1, 'day'));
    };

    const handleToday = () => setCurrentDate(dayjs());

    const handleDayClick = (day) => {
        setCurrentDate(day);
        if (views.includes('day')) setView('day');
    };

    const toggleCalendarVisibility = (id) => {
        setCalendars(calendars.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c)));
    };

    const titleFormat = () => {
        switch (view) {
            case 'month':
                return currentDate.format('MMMM YYYY');
            case 'week':
            case 'agenda': {
                const weekStart = currentDate.startOf('week');
                const weekEnd = weekStart.add(6, 'day');
                return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
            }
            case 'day':
                return Intl.DateTimeFormat(navigator.language, {
                    dateStyle: 'medium',
                }).format(currentDate.toDate());
            default:
                return '';
        }
    };

    const viewOptions = [
        { key: 'day', label: 'Day', icon: RiMenuLine },
        { key: 'week', label: 'Week', icon: RiLayoutRowLine },
        { key: 'month', label: 'Month', icon: RiLayoutGridLine },
        { key: 'agenda', label: 'Agenda', icon: RiCalendar2Line },
    ].filter((option) => views.includes(option.key));

    const currentViewLabel = useMemo(() => {
        return viewOptions.find((option) => option.key === view)?.label || 'View';
    }, [view, viewOptions]);

    return (
        <div className="bg-content2 text-foreground h-[88vh] flex flex-col rounded-lg border  dark:border-content3">
            {/* Header */}
            <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                <div className="w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="faded" onPress={handleToday}>
                            Today
                        </Button>
                        <div className="flex items-center">
                            <Button size="sm" variant="light" isIconOnly onPress={handlePrev}>
                                <RiArrowLeftSLine className="h-5 w-5" />
                            </Button>
                            <Button size="sm" variant="light" isIconOnly onPress={handleNext}>
                                <RiArrowRightSLine className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                    <h4 className="font-semibold text-center text-md truncate">{titleFormat()}</h4>
                    <div className="flex items-center gap-2">
                        <Dropdown>
                            <DropdownTrigger>
                                <Button
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    startContent={<RiCalendar2Line fontSize="1.1rem" />}
                                ></Button>
                            </DropdownTrigger>
                            <DropdownMenu>
                                {calendars.map((cal) => (
                                    <DropdownItem key={cal.id} onSelect={(e) => e.preventDefault()}>
                                        <label className="flex items-center gap-3 cursor-pointer w-full">
                                            <input
                                                type="checkbox"
                                                checked={cal.isVisible}
                                                onChange={() => toggleCalendarVisibility(cal.id)}
                                                className={`h-4 w-4 rounded text-${cal.color}-600 focus:ring-${cal.color}-500 border-gray-300`}
                                            />
                                            <span className="text-sm">{cal.name}</span>
                                        </label>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </Dropdown>
                        {views?.length > 1 && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button size="sm" variant="light">
                                        {currentViewLabel}
                                        <RiArrowDownSLine className="h-5 w-5" />
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu onAction={(key) => setView(key)}>
                                    {viewOptions.map((option) => (
                                        <DropdownItem
                                            key={option.key}
                                            startContent={<option.icon fontSize="1.1rem" />}
                                            endContent={
                                                view === option.key ? <RiCheckLine /> : null
                                            }
                                        >
                                            {option.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </Dropdown>
                        )}
                        <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            isIconOnly
                            startContent={<RiAddLine fontSize="1.1rem" />}
                        ></Button>
                    </div>
                </div>
            </header>

            {/* Calendar Body */}
            <main className="flex-grow flex flex-col overflow-hidden">
                {view === 'month' && (
                    <MonthView
                        currentDate={currentDate}
                        events={filteredEvents}
                        onDayClick={handleDayClick}
                    />
                )}
                {view === 'week' && <WeekView currentDate={currentDate} events={filteredEvents} />}
                {view === 'day' && <DayView currentDate={currentDate} events={filteredEvents} />}
                {view === 'agenda' && (
                    <AgendaView currentDate={currentDate} events={filteredEvents} />
                )}
            </main>
        </div>
    );
};

export default EventCalendar;
