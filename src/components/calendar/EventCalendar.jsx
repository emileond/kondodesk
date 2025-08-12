import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isToday from 'dayjs/plugin/isToday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Tooltip,
} from '@heroui/react';
import {
    RiArrowDownSLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiCalendar2Line,
    RiCheckLine,
    RiLayoutGridLine,
    RiLayoutRowLine,
    RiMenuLine,
} from 'react-icons/ri';
import { useCalendars, useEvents } from '../../hooks/react-query/calendars/useCalendars.js';
import IntegrationSourceIcon from '../tasks/integrations/IntegrationSourceIcon.jsx';
import EventItem from './EventItem.jsx';
import { parseToLocal } from '../../utils/dateUtils.js';
import EmptyState from '../EmptyState.jsx';

// FIX: These plugins must be extended for dayjs to have the required functionality.
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isToday);
dayjs.extend(localizedFormat);
dayjs.extend(isSameOrBefore);
dayjs.tz.setDefault(dayjs.tz.guess()); // Auto-detect user's timezone

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
                            className="h-24 text-right pr-2 text-xs text-gray-500 dark:text-gray-400 border-r border-content4"
                        >
                            {dayjs().hour(hour).format('hA')}
                        </div>
                    ))}
                </div>
                <div className="relative flex-grow">
                    {/* Background Hour Slots */}
                    {hours.map((hour) => {
                        const hasPassed = isToday && hour < currentTime.hour();
                        return (
                            <div
                                key={hour}
                                className={`h-24 border-b border-content4 ${hasPassed ? 'bg-content3/40' : ''}`}
                            ></div>
                        );
                    })}

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
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [view, setView] = useState(initialView);

    const [dateRange, setDateRange] = useState({});

    // Fetch calendars and events using React Query hooks
    const { data: fetchedCalendars, isLoading: isLoadingCalendars } = useCalendars();
    const { data: events, isLoading: isLoadingEvents } = useEvents(dateRange);

    const [uiCalendars, setUiCalendars] = useState([]);

    // Initialize UI calendars when fetchedCalendars data arrives
    useEffect(() => {
        if (fetchedCalendars) {
            setUiCalendars(fetchedCalendars.map((cal) => ({ ...cal, isVisible: true })));
        }
    }, [fetchedCalendars]);

    // Update the date range whenever the view or current date changes
    useEffect(() => {
        let start, end;
        if (view === 'month') {
            const monthStart = currentDate.startOf('month');
            start = monthStart.startOf('week').toISOString();
            end = monthStart.endOf('month').endOf('week').toISOString();
        } else if (view === 'week' || view === 'agenda') {
            start = currentDate.startOf('week').toISOString();
            end = currentDate.endOf('week').toISOString();
        } else if (view === 'day') {
            start = currentDate.startOf('day').toISOString();
            end = currentDate.endOf('day').toISOString();
        }
        setDateRange({ start, end });
    }, [currentDate, view]);

    // Memoize a map of calendar IDs to calendar objects for efficient lookup
    const calendarMap = useMemo(() => {
        if (!uiCalendars) return new Map();
        return new Map(uiCalendars.map((cal) => [cal.id, cal]));
    }, [uiCalendars]);

    // Get a list of visible calendar IDs for filtering
    const visibleCalendarIds = useMemo(
        () => uiCalendars.filter((c) => c.isVisible).map((c) => c.id),
        [uiCalendars],
    );

    // Filter events based on visible calendars and enrich them with calendar data (color, name)
    const filteredEvents = useMemo(() => {
        if (!events || !visibleCalendarIds || !calendarMap) return [];
        return events
            .filter((event) => visibleCalendarIds.includes(event.calendar_id))
            .map((event) => ({
                ...event,
                start: event.start_time,
                end: event.end_time,
                color: calendarMap.get(event.calendar_id)?.color || 'gray',
                calendarName: calendarMap.get(event.calendar_id)?.name || 'Unknown',
            }));
    }, [events, visibleCalendarIds, calendarMap]);

    const handlePrev = () => {
        const newDate =
            view === 'month'
                ? currentDate.subtract(1, 'month')
                : view === 'day'
                  ? currentDate.subtract(1, 'day')
                  : currentDate.subtract(1, 'week');
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate =
            view === 'month'
                ? currentDate.add(1, 'month')
                : view === 'day'
                  ? currentDate.add(1, 'day')
                  : currentDate.add(1, 'week');
        setCurrentDate(newDate);
    };

    const handleToday = () => setCurrentDate(dayjs());

    const handleDayClick = (day) => {
        setCurrentDate(day);
        if (views.includes('day')) setView('day');
    };

    const toggleCalendarVisibility = (id) => {
        setUiCalendars(
            uiCalendars.map((c) => (c.id === id ? { ...c, isVisible: !c.isVisible } : c)),
        );
    };

    const titleFormat = () => {
        switch (view) {
            case 'month':
                return currentDate.format('MMMM YYYY');
            case 'week':
            case 'agenda': {
                const weekStart = currentDate.startOf('week');
                const weekEnd = weekStart.add(6, 'day');
                return Intl.DateTimeFormat(navigator.language, {
                    dateStyle: 'medium',
                }).formatRange(weekStart.toDate(), weekEnd.toDate(), {
                    dateStyle: 'medium',
                });
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

    const currentViewLabel = useMemo(
        () => viewOptions.find((option) => option.key === view)?.label || 'View',
        [view, viewOptions],
    );

    const handleEmptyStateClick = () => {
        navigate('/integrations');
    };

    // Display a loading indicator while fetching initial data
    if (isLoadingCalendars) {
        return (
            <div className="flex items-center justify-center h-[88vh]">Loading Calendars...</div>
        );
    }

    if (!uiCalendars && !events) {
        return (
            <div className="bg-content2 text-foreground h-[88vh] flex flex-col rounded-lg border border-content4 shadow-2xl">
                <EmptyState
                    title="No calendars found"
                    description="Connect a calendar to get started."
                    primaryAction="Connect a calendar"
                    img="calendar"
                    onClick={handleEmptyStateClick}
                />
            </div>
        );
    }

    return (
        <div className="bg-content2 text-foreground h-[88vh] flex flex-col rounded-lg border border-content4 shadow-2xl">
            {/* Header */}
            <header className="flex-shrink-0 p-4 border-b border-content4 flex flex-wrap items-center justify-between gap-4">
                <div className="w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
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
                    <h4 className="font-semibold text-center text-sm truncate">{titleFormat()}</h4>
                    <div className="flex items-center gap-1">
                        <Dropdown>
                            <Tooltip content="Calendars" placement="bottom">
                                <div>
                                    <DropdownTrigger>
                                        <Button
                                            size="sm"
                                            variant="light"
                                            isIconOnly
                                            startContent={<RiCalendar2Line fontSize="1.1rem" />}
                                        ></Button>
                                    </DropdownTrigger>
                                </div>
                            </Tooltip>
                            <DropdownMenu>
                                {uiCalendars.map((cal) => (
                                    <DropdownItem
                                        key={cal.id}
                                        onSelect={(e) => e.preventDefault()}
                                        startContent={<IntegrationSourceIcon type={cal.source} />}
                                        endContent={
                                            cal.isVisible && (
                                                <RiCheckLine
                                                    className={`h-4 w-4 text-${cal.color}-600`}
                                                />
                                            )
                                        }
                                        onPress={() => toggleCalendarVisibility(cal.id)}
                                    >
                                        {cal.name}
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
                        {/*<Button*/}
                        {/*    size="sm"*/}
                        {/*    variant="flat"*/}
                        {/*    color="primary"*/}
                        {/*    isIconOnly*/}
                        {/*    startContent={<RiAddLine fontSize="1.1rem" />}*/}
                        {/*></Button>*/}
                    </div>
                </div>
            </header>

            {/* Calendar Body */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Conditionally render views based on the current view state */}
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
            </div>
        </div>
    );
};

export default EventCalendar;
