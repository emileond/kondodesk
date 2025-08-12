import { useDisclosure, Accordion, AccordionItem, Alert, Progress, Button } from '@heroui/react';
import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import {
    RiAddLine,
    RiCalendarEventLine,
    RiCalendarScheduleLine,
    RiCollapseVerticalLine,
    RiExpandVerticalSLine,
} from 'react-icons/ri';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import { useTasks, useUpdateMultipleTasks } from '../hooks/react-query/tasks/useTasks.js';
import TasksFilters from '../components/tasks/TasksFilters.jsx';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Paywall from '../components/marketing/Paywall';
import NewTaskModal from '../components/tasks/NewTaskModal.jsx';
import dayjs from 'dayjs';
import DraggableList from '../components/tasks/DraggableList.jsx';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import TaskCard from '../components/tasks/TaskCard.jsx';
import DatePicker from '../components/form/DatePicker.jsx';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { taskOverloadMessages } from '../utils/alert-messages/taskOverload.js';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import EmptyState from '../components/EmptyState.jsx';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useQueryClient } from '@tanstack/react-query';
import TaskViewToggle from '../components/nav/TaskViewToggle.jsx';
import KanbanView from '../components/tasks/KanbanView.jsx';
import TableView from '../components/tasks/TableView.jsx';
import { PomodoroWidget } from '../components/widgets/pomodoro/PomodoroWidget.jsx';
import { BreathExerciseWidget } from '../components/widgets/relax/BreathExerciseWidget.jsx';
import EventCalendar from '../components/calendar/EventCalendar.jsx';

dayjs.extend(utc);
dayjs.extend(timezone);

function DashboardPage() {
    const [pageView, setPageView] = useState();
    const [parent] = useAutoAnimate();
    const [currentWorkspace] = useCurrentWorkspace();
    const { isOpen, onOpenChange } = useDisclosure();
    const [insufficientCredits, setInsufficientCredits] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [isTaskAlertDismissed, setIsTaskAlertDismissed] = useState(false);
    const [showFilters, setShowFilters] = useState(true);
    const [filters, setFilters] = useState({
        project_id: null,
        milestone_id: null,
        tags: null,
        integration_source: null,
        priority: null,
    });
    const queryClient = useQueryClient();
    const { data: todayTasks, refetch: refetchToday } = useTasks(currentWorkspace, {
        ...filters,
        startDate: dayjs().startOf('day').toISOString(),
        endDate: dayjs().endOf('day').toISOString(),
        includeInProgress: true,
    });
    const { data: overdueTasks, refetch: refetchOverdue } = useTasks(currentWorkspace, {
        statusList: ['pending'],
        assignees: filters.assignees,
        endDate: dayjs().endOf('day').subtract(1, 'day').toISOString(),
    });

    const { mutateAsync: updateMultipleTasks } = useUpdateMultipleTasks(currentWorkspace);
    const listDate = dayjs().startOf('day').tz(dayjs.tz.guess(), true).toISOString();
    const confettiShownRef = useRef(false);
    const today = dayjs().format('YYYY-MM-DD');
    // Store the task overload message in a ref so it doesn't change on re-renders
    const taskOverloadMessageRef = useRef('');

    const hasOVerdueTasks = overdueTasks?.length > 0;
    const hasTooManyTasks = todayTasks?.length > 6;
    const [hideTasks, setHideTasks] = useState(false);

    // Calculate completed tasks count and percentage
    const completedTasksCount = useMemo(() => {
        if (!todayTasks) return 0;
        return todayTasks.filter((task) => task.status === 'completed').length;
    }, [todayTasks]);

    const completedPercentage = useMemo(() => {
        if (!todayTasks || todayTasks.length === 0) return 0;
        return Math.round((completedTasksCount / todayTasks.length) * 100);
    }, [todayTasks, completedTasksCount]);

    // Get a random message from the taskOverloadMessages array
    const getRandomTaskOverloadMessage = () => {
        if (!taskOverloadMessageRef.current) {
            const randomIndex = Math.floor(Math.random() * taskOverloadMessages.length);
            taskOverloadMessageRef.current = taskOverloadMessages[randomIndex].message;
        }
        return taskOverloadMessageRef.current;
    };

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    // Handle dismissing the task overload alert
    const handleDismiss = () => {
        setIsTaskAlertDismissed(true);
        localStorage.setItem('task-alert-dismissed', today);
    };

    const rescheduleOverdueTasks = async (newDate) => {
        if (!newDate && !isRescheduling) return;
        const tasksToUpdate = overdueTasks?.map((item) => ({
            taskId: item.id,
            updates: {
                date: newDate ? dayjs(newDate).toISOString() : null,
            },
        }));

        try {
            await updateMultipleTasks({ tasks: tasksToUpdate });
            await Promise.all([refetchToday(), refetchOverdue()]);

            const startDate = dayjs(newDate)?.startOf('day').toISOString();
            const endDate = dayjs(newDate)?.endOf('day').toISOString();

            if (newDate) {
                await queryClient.invalidateQueries([
                    'tasks',
                    currentWorkspace.workspace_id,
                    {
                        startDate,
                        endDate,
                    },
                ]);
            } else {
                await queryClient.invalidateQueries([
                    'backlogTasks',
                    currentWorkspace.workspace_id,
                ]);
            }

            toast.success('Tasks rescheduled');
        } catch (error) {
            console.error('Error updating tasks:', error);
        }
    };

    const handleViewChange = (newView) => {
        setPageView(newView);
    };

    const renderTasksView = () => {
        switch (pageView) {
            case 'list':
                return (
                    <DraggableList
                        id={listDate}
                        items={todayTasks || []}
                        group="today-tasks"
                        onDragEnd={async (e, startCol) => {
                            // Handle drag and drop logic for today's tasks
                            const endCol = e.parent.el.id;

                            // Update task order
                            try {
                                await updateMultipleTasks({
                                    tasks: e.values.map((item, index) => ({
                                        taskId: item.id,
                                        updates: {
                                            order: index,
                                        },
                                    })),
                                    startCol,
                                    endCol,
                                });
                            } catch (error) {
                                console.error('Error updating tasks:', error);
                            }
                        }}
                    />
                );
            case 'kanban':
                return <KanbanView items={todayTasks} />;
            case 'table':
                return <TableView pageKey="today" items={todayTasks} />;
            default:
                // Fallback for an unrecognized pageView or a default view
                return <p>Select a valid view mode.</p>;
        }
    };

    useEffect(() => {
        // Check if there are tasks for today and all of them are completed
        if (todayTasks && todayTasks.length > 0) {
            const allTasksCompleted = todayTasks.every((task) => task.status === 'completed');

            // If all tasks are completed and confetti hasn't been shown yet, show confetti
            if (allTasksCompleted && !confettiShownRef.current) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.2 },
                });
                confettiShownRef.current = true;
            } else if (!allTasksCompleted) {
                // Reset the ref if not all tasks are completed
                confettiShownRef.current = false;
            }
        }
    }, [todayTasks]);

    // Check if the task alert has been dismissed today
    useEffect(() => {
        const dismissedDate = localStorage.getItem('task-alert-dismissed');
        const isDismissed = dismissedDate === today;
        setIsTaskAlertDismissed(isDismissed);
    }, [today]);

    useEffect(() => {
        if (completedPercentage === 100 && todayTasks?.length > 0) {
            // Hide the task list when all tasks are completed.
            setIsTaskAlertDismissed(true);
            setHideTasks(true);
        } else {
            // IMPORTANT: Show the task list again if the percentage is no longer 100.
            setHideTasks(false);
        }
    }, [completedPercentage, todayTasks]);

    const [viewCalendar, setViewCalendar] = useState(false);

    return (
        <AppLayout>
            <Paywall
                isOpen={insufficientCredits}
                onOpenChange={(open) => {
                    if (!open) {
                        setInsufficientCredits(false);
                    }
                }}
                feature="more credits"
            />
            <NewTaskModal isOpen={isOpen} onOpenChange={onOpenChange} defaultDate={new Date()} />
            <PageLayout
                maxW={viewCalendar ? 'full' : pageView === 'list' ? '3xl' : '6xl'}
                title="Today"
                primaryAction="New task"
                icon={<RiAddLine fontSize="1.1rem" />}
                onClick={onOpenChange}
                customElements={
                    <div className="flex gap-3">
                        <BreathExerciseWidget />
                        <PomodoroWidget />
                    </div>
                }
            >
                <TaskViewToggle pageKey="today" onChange={handleViewChange} />
                <div className="flex justify-between items-start">
                    <TasksFilters
                        showFilters={showFilters}
                        onShowFiltersChange={setShowFilters}
                        onFiltersChange={handleFiltersChange}
                        initialFilters={filters}
                    />
                    <Button
                        size="sm"
                        variant={viewCalendar ? 'flat' : 'light'}
                        color={viewCalendar ? 'primary' : 'default'}
                        startContent={<RiCalendarEventLine fontSize="1.1rem" />}
                        className="text-default-600 hover:text-default-700"
                        onPress={() => setViewCalendar(!viewCalendar)}
                    >
                        Events
                    </Button>
                </div>
                <div className="flex gap-3">
                    <div className="flex flex-col gap-3 mb-9 basis-3/4 grow">
                        <div ref={parent} className="flex flex-col gap-2">
                            {hasTooManyTasks && !isTaskAlertDismissed && (
                                <Alert
                                    description={getRandomTaskOverloadMessage()}
                                    color="primary"
                                    onClose={handleDismiss}
                                />
                            )}
                            {todayTasks && todayTasks.length > 0 && (
                                <div className="py-3 flex gap-3">
                                    <Progress
                                        label={`${completedTasksCount}/${todayTasks.length} completed`}
                                        aria-label="Today's progress"
                                        size="sm"
                                        color="success"
                                        maxValue={todayTasks.length}
                                        value={completedTasksCount}
                                    />
                                    {completedPercentage === 100 && (
                                        <div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="font-medium text-default-500"
                                                onPress={() => setHideTasks(!hideTasks)}
                                                endContent={
                                                    hideTasks ? (
                                                        <RiExpandVerticalSLine fontSize="1rem" />
                                                    ) : (
                                                        <RiCollapseVerticalLine fontSize="1rem" />
                                                    )
                                                }
                                            >
                                                {hideTasks ? 'Show' : 'Hide'} tasks
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {hasOVerdueTasks && (
                                <Accordion>
                                    <AccordionItem
                                        key="overdue-tasks"
                                        textValue="overdue tasks"
                                        title={
                                            <div className="w-full flex items-center gap-3 justify-between">
                                                <span className="text-sm font-medium">
                                                    Overdue ({overdueTasks?.length})
                                                </span>
                                                <DatePicker
                                                    onChange={(val) => {
                                                        (rescheduleOverdueTasks(val),
                                                            setIsRescheduling(true));
                                                    }}
                                                    trigger={
                                                        <div className="flex gap-2 text-xs text-primary rounded-md border-2 border-default bg-primary-50 hover:text-primary-500 py-1.5 px-3">
                                                            <RiCalendarScheduleLine fontSize="1rem" />
                                                            Reschedule
                                                        </div>
                                                    }
                                                />
                                            </div>
                                        }
                                    >
                                        <div className="flex flex-col gap-2">
                                            {overdueTasks?.map((task) => (
                                                <TaskCard key={task.id} task={task} sm />
                                            ))}
                                        </div>
                                    </AccordionItem>
                                </Accordion>
                            )}
                            {todayTasks?.length === 0 ? (
                                <EmptyState
                                    title="Nothing here yet"
                                    description="Let’s get you rolling, start by creating your first to-do"
                                    primaryAction="Add a task"
                                    onClick={onOpenChange}
                                />
                            ) : !hideTasks ? (
                                renderTasksView()
                            ) : (
                                <div>
                                    <div className="flex flex-col items-center gap-3 px-12">
                                        <div className="h-64">
                                            <DotLottieReact src="/lottie/done.lottie" autoplay />
                                        </div>
                                        <h2 className="text-default-800 text-2xl font-semibold mt-[-50px] mb-1">
                                            That’s a wrap!
                                        </h2>
                                        <p className="text-default-600 text-center text-pretty">
                                            Grab snack, blast some tunes, or just kick back and
                                            relax.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {viewCalendar && (
                        <div className="basis-1/4 shrink min-w-[360px]">
                            <EventCalendar initialView="day" views={['day']} />
                        </div>
                    )}
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default DashboardPage;
