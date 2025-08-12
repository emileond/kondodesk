import { useMemo, useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { supabaseClient } from '../../lib/supabase.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import {
    Button,
    useDisclosure,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Spinner,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Divider,
    Switch,
    Checkbox,
} from '@heroui/react';
import { RiExpandLeftLine, RiContractRightLine, RiCalendarEventLine } from 'react-icons/ri';
import BacklogPanel from './BacklogPanel.jsx';
import { useUpdateMultipleTasks } from '../../hooks/react-query/tasks/useTasks.js';
import utc from 'dayjs/plugin/utc';
import ky from 'ky';
import DayColumn from './DayColumn.jsx';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import TasksFilters from './TasksFilters.jsx';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useCalendars, useEvents } from '../../hooks/react-query/calendars/useCalendars.js';
import IntegrationSourceIcon from './integrations/IntegrationSourceIcon.jsx';

dayjs.extend(utc);

const UpcomingTasks = ({
    onAutoPlan,
    onRollback,
    lastPlanResponse,
    setLastPlanResponse,
    dateRange,
}) => {
    const [filters, setFilters] = useState({
        project_id: null,
        milestone_id: null,
        tags: null,
        integration_source: null,
        priority: null,
        assignees: null,
    });
    const queryClient = useQueryClient();
    const [currentWorkspace] = useCurrentWorkspace();
    const {
        isOpen: isLoadingOpen,
        onOpen: onLoadingOpen,
        onClose: onLoadingClose,
    } = useDisclosure();
    const [loadingMessage, setLoadingMessage] = useState('Optimizing plan...');

    // calendar data
    const [showEvents, setShowEvents] = useState(() => {
        return typeof window !== 'undefined'
            ? localStorage.getItem('showPlannerEvents') === 'true'
            : false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('showPlannerEvents', String(showEvents));
        }
    }, [showEvents]);

    const eventDateRange = useMemo(() => {
        if (!dateRange || !dateRange.from || !dateRange.to) return {};
        return {
            start: dayjs(dateRange.from).toISOString(),
            end: dayjs(dateRange.to).toISOString(),
        };
    }, [dateRange]);

    const { data: fetchedCalendars, isLoading: isLoadingCalendars } = useCalendars();
    const { data: events, isLoading: isLoadingEvents } = useEvents(eventDateRange);

    const [uiCalendars, setUiCalendars] = useState([]);

    useEffect(() => {
        if (fetchedCalendars) {
            setUiCalendars(fetchedCalendars.map((cal) => ({ ...cal, isVisible: true })));
        }
    }, [fetchedCalendars]);

    const handleCalendarToggle = (calendarId) => {
        setUiCalendars((currentCalendars) =>
            currentCalendars.map((cal) =>
                cal.id === calendarId ? { ...cal, isVisible: !cal.isVisible } : cal,
            ),
        );
    };

    const visibleCalendarIds = useMemo(() => {
        return uiCalendars.filter((cal) => cal.isVisible).map((cal) => cal.id);
    }, [uiCalendars]);

    const calendarMap = useMemo(() => {
        if (!fetchedCalendars) return new Map();
        return new Map(fetchedCalendars.map((cal) => [cal.id, cal]));
    }, [fetchedCalendars]);

    const enrichedEvents = useMemo(() => {
        if (!events) return [];
        return events
            .filter((event) => visibleCalendarIds.includes(event.calendar_id))
            .map((event) => ({
                ...event,
                start: event.start_time,
                end: event.end_time,
                color: calendarMap.get(event.calendar_id)?.color || 'gray',
                calendarName: calendarMap.get(event.calendar_id)?.name || 'Unknown',
            }));
    }, [events, calendarMap, visibleCalendarIds]);

    const eventsByDay = useMemo(() => {
        const grouped = {};
        enrichedEvents.forEach((event) => {
            const dayStr = dayjs(event.start_time).format('YYYY-MM-DD');
            if (!grouped[dayStr]) {
                grouped[dayStr] = [];
            }
            grouped[dayStr].push(event);
        });
        return grouped;
    }, [enrichedEvents]);

    // State and controls for the new summary modal
    const [planSummary, setPlanSummary] = useState('');
    const {
        isOpen: isSummaryOpen,
        onOpen: onSummaryOpen,
        onClose: onSummaryClose,
    } = useDisclosure();

    const { mutateAsync: updateMultipleTasks } = useUpdateMultipleTasks(currentWorkspace);

    const loadingMessages = useMemo(
        () => [
            'Optimizing plan...',
            'Finding the smartest schedule...',
            'Analyzing task priorities...',
            'Balancing your workload...',
            'Calculating optimal distribution...',
            'Applying AI scheduling algorithms...',
        ],
        [],
    );

    useEffect(() => {
        let messageInterval;
        if (isLoadingOpen) {
            let index = 0;
            messageInterval = setInterval(() => {
                index = (index + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[index]);
            }, 3000);
        }
        return () => clearInterval(messageInterval);
    }, [isLoadingOpen, loadingMessages]);

    const days = useMemo(() => {
        if (!dateRange.from || !dateRange.to) return [];
        const start = dayjs(dateRange.from);
        const end = dayjs(dateRange.to);
        const result = [];
        let current = start;
        while (current.isBefore(end) || current.isSame(end, 'day')) {
            result.push(current);
            current = current.add(1, 'day');
        }
        return result;
    }, [dateRange]);

    const startDate = days.length > 0 ? days[0].startOf('day').toISOString() : null;
    const endDate = days.length > 0 ? days[days.length - 1].endOf('day').toISOString() : null;

    const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(() => {
        return typeof window !== 'undefined'
            ? localStorage.getItem('isBacklogCollapsed') === 'true'
            : false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('isBacklogCollapsed', String(isBacklogCollapsed));
        }
    }, [isBacklogCollapsed]);

    const handleToggleCollapse = useCallback(() => {
        setIsBacklogCollapsed((prevState) => !prevState);
    }, []);

    const handleRollback = useCallback(async () => {
        if (!lastPlanResponse || !Array.isArray(lastPlanResponse)) {
            console.error('No plan response to rollback');
            return;
        }
        onLoadingOpen();
        setLoadingMessage('Rolling back changes...');
        const tasksToUpdate = lastPlanResponse.map((task) => ({
            taskId: task.id,
            updates: { date: null },
        }));
        try {
            await updateMultipleTasks({ tasks: tasksToUpdate });
            setLastPlanResponse(null);
            toast.success('Changes reverted');
            await queryClient.invalidateQueries({
                queryKey: ['tasks', currentWorkspace?.workspace_id],
            });
        } catch (error) {
            console.error('Error rolling back changes:', error);
            toast.error('Error rolling back changes');
        } finally {
            onLoadingClose();
        }
    }, [
        lastPlanResponse,
        updateMultipleTasks,
        setLastPlanResponse,
        queryClient,
        currentWorkspace,
        onLoadingOpen,
        onLoadingClose,
    ]);

    const autoPlan = useCallback(async () => {
        setIsBacklogCollapsed(true);
        onLoadingOpen();
        setLoadingMessage('Optimizing plan...');

        if (!startDate || !endDate) {
            toast.error('Please select a valid date range.');
            onLoadingClose();
            return;
        }

        const availableDates = [];
        const start = dayjs(startDate);
        const end = dayjs(endDate);

        const { data } = await supabaseClient.rpc('get_tasks_count_per_day', {
            p_workspace_id: currentWorkspace?.workspace_id,
            p_start_date: dayjs(startDate).startOf('day').toISOString(),
            p_end_date: dayjs(endDate).endOf('day').toISOString(),
        });

        const countsByDay = data.reduce((map, { day, count }) => {
            const key = dayjs.utc(day).format('YYYY-MM-DD');
            map[key] = count;
            return map;
        }, {});

        let current = start;
        while (current.isBefore(end) || current.isSame(end, 'day')) {
            const key = current.format('YYYY-MM-DD');
            const weekday = current.day();
            const weekdayName = current.format('dddd');
            if (weekday >= 1 && weekday <= 5) {
                const taskCount = countsByDay[key] || 0;
                if (taskCount < 2) {
                    availableDates.push({
                        date: current.startOf('day').toISOString(),
                        weekday: weekdayName,
                    });
                }
            }
            current = current.add(1, 'day');
        }

        try {
            const response = await ky
                .post('/api/ai/plan', {
                    json: {
                        startDate,
                        endDate,
                        availableDates,
                        workspace_id: currentWorkspace?.workspace_id,
                    },
                    timeout: false,
                })
                .json();

            // Handle the new response structure
            setLastPlanResponse(response.plan);
            setPlanSummary(response.reasoning);
            onSummaryOpen(); // Open the summary modal

            if (response.plan && response.plan.length > 0) {
                await queryClient.invalidateQueries({
                    queryKey: ['tasks', currentWorkspace?.workspace_id],
                });
            }
        } catch (error) {
            console.error('Error in auto plan:', error);
            toast.error('Failed to generate a plan. Please try again.');
        } finally {
            onLoadingClose();
        }
    }, [
        startDate,
        endDate,
        currentWorkspace,
        setLastPlanResponse,
        queryClient,
        onLoadingOpen,
        onLoadingClose,
        onSummaryOpen,
    ]);

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    useEffect(() => {
        if (onAutoPlan && currentWorkspace) onAutoPlan.current = autoPlan;
        if (onRollback && currentWorkspace) onRollback.current = handleRollback;
    }, [onAutoPlan, onRollback, currentWorkspace, autoPlan, handleRollback]);

    return (
        <>
            {/* Loading Modal */}
            <Modal isOpen={isLoadingOpen} hideCloseButton={true} isDismissable={false}>
                <ModalContent>
                    <ModalBody className="py-8">
                        <div className="flex flex-col items-center gap-6">
                            <Spinner size="lg" color="primary" variant="wave" />
                            <p className="font-medium text-center text-default-500">
                                {loadingMessage}
                            </p>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* Plan Summary Modal */}
            <Modal isOpen={isSummaryOpen} onOpenChange={onSummaryClose}>
                <ModalContent>
                    <ModalHeader>Auto-Plan Complete</ModalHeader>
                    <ModalBody>
                        <div className="h-52">
                            <DotLottieReact src="/lottie/calendar.lottie" autoplay loop />
                        </div>
                        <p className="text-default-700">{planSummary}</p>
                        <p className="mt-4 text-sm text-default-500">
                            If you're not happy with this plan, you can undo it by clicking the
                            "Rollback" button.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="primary" onPress={onSummaryClose}>
                            Got it
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <div className="flex justify-between mb-2">
                <TasksFilters
                    defaultToAllUsers
                    onFiltersChange={handleFiltersChange}
                    initialFilters={filters}
                />
                <div className="flex gap-2 items-center">
                    <Popover placement="bottom-end">
                        <PopoverTrigger>
                            <Button
                                size="sm"
                                variant={showEvents ? 'flat' : 'light'}
                                color={showEvents ? 'primary' : 'default'}
                                startContent={<RiCalendarEventLine fontSize="1.1rem" />}
                                className="text-default-600 hover:text-default-700"
                            >
                                Events
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-4 w-64">
                            <div className="flex flex-col gap-4 w-full">
                                {/*<h4 className="text-sm font-semibold">Events</h4>*/}
                                <Switch
                                    size="sm"
                                    isSelected={showEvents}
                                    onValueChange={setShowEvents}
                                    className="font-medium"
                                >
                                    Events on planner
                                </Switch>
                                <Divider />
                                <h4 className="text-sm font-medium text-default-500">Calendars</h4>
                                <div className="flex flex-col gap-2">
                                    {isLoadingCalendars ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            {uiCalendars.map((cal) => (
                                                <Checkbox
                                                    key={cal.id}
                                                    isSelected={cal.isVisible}
                                                    onValueChange={() =>
                                                        handleCalendarToggle(cal.id)
                                                    }
                                                >
                                                    <span className="flex gap-2">
                                                        <IntegrationSourceIcon type={cal.source} />
                                                        {cal.name}
                                                    </span>
                                                </Checkbox>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        size="sm"
                        variant="light"
                        onPress={handleToggleCollapse}
                        startContent={
                            isBacklogCollapsed ? (
                                <RiExpandLeftLine fontSize="1.1rem" />
                            ) : (
                                <RiContractRightLine fontSize="1.1rem" />
                            )
                        }
                        className="text-default-600 hover:text-default-700"
                    >
                        {isBacklogCollapsed ? 'Show backlog' : 'Hide backlog'}
                    </Button>
                </div>
            </div>
            <div className="flex gap-3 h-[calc(100vh-140px)]">
                <div className="basis-2/3 grow flex gap-4 overflow-x-auto snap-x">
                    {days.map((day) => {
                        const dateStr = day.format('YYYY-MM-DD');
                        return (
                            <DayColumn
                                key={dateStr}
                                day={day}
                                filters={filters}
                                events={eventsByDay[dateStr] || []}
                                showEvents={showEvents}
                                isLoadingEvents={isLoadingEvents || isLoadingCalendars}
                            />
                        );
                    })}
                </div>
                <BacklogPanel isBacklogCollapsed={isBacklogCollapsed} />
            </div>
        </>
    );
};

export default UpcomingTasks;
