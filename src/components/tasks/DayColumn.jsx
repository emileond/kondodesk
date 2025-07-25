import { Button, useDisclosure } from '@heroui/react';
import { RiAddLine } from 'react-icons/ri';
import DraggableList from './DraggableList.jsx';
import dayjs from 'dayjs';
import { useState } from 'react';
import NewTaskModal from './NewTaskModal.jsx';
import { useTasks, useUpdateMultipleTasks } from '../../hooks/react-query/tasks/useTasks.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import timezone from 'dayjs/plugin/timezone'; // For handling time zones
import utc from 'dayjs/plugin/utc';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const DayColumn = ({ day, filters }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { mutateAsync: updateMultipleTasks } = useUpdateMultipleTasks(currentWorkspace);

    const startDate = dayjs(day)?.startOf('day').toISOString();
    const endDate = dayjs(day)?.endOf('day').toISOString();

    const { data: tasks } = useTasks(currentWorkspace, {
        ...filters,
        startDate,
        endDate,
    });

    const [newTaskDate, setNewTaskDate] = useState(null);
    const { isOpen, onOpenChange } = useDisclosure();

    const handleDragEnd = async (e, startCol) => {
        const endCol = e.parent.el.id; // YYYY-MM-DD string

        const itemIndex = e?.draggedNode?.data.index;
        const itemId = e?.draggedNode?.data?.value?.id;
        const itemDate = e?.draggedNode?.data?.value?.date
            ? dayjs(e?.draggedNode?.data?.value?.date)?.tz(dayjs.tz.guess(), true)?.toISOString()
            : null;

        const columnItems = e.values; // The items in the target column
        const newDate = e.parent.el.id; // The target list (backlog or a date)

        // If the target list is valid (a date column)
        let updatedDate = null;
        if (dayjs(newDate).isValid()) {
            updatedDate = dayjs(newDate).startOf('day').tz(dayjs.tz.guess(), true).toISOString();
        }

        // if item date and target date are the same, return
        if (itemDate === updatedDate) return;

        let tasksToUpdate = null;

        // Prepare the tasks to be updated
        if (updatedDate) {
            // only update all items in the column if is a day col
            tasksToUpdate = columnItems.map((item, index) => ({
                taskId: item.id,
                updates: {
                    date: updatedDate,
                    order: index,
                },
            }));
        } else {
            // otherwise is going to the backlog, so only update the dragged item
            tasksToUpdate = [
                {
                    taskId: itemId,
                    updates: {
                        date: null,
                        order: itemIndex,
                    },
                },
            ];
        }

        // Call the bulk update function
        try {
            await updateMultipleTasks({
                tasks: tasksToUpdate,
                startCol: startCol || 'backlog',
                endCol,
            });
        } catch (error) {
            console.error('Error updating tasks:', error);
        }
    };

    const handleNewTask = (dateStr) => {
        setNewTaskDate(dayjs(dateStr));
        onOpenChange();
    };

    const dateStr = day.format('YYYY-MM-DD');
    const isToday = day.isSame(dayjs(), 'day');
    const isWeekend = day.day() === 0 || day.day() === 6; // 0 is Sunday, 6 is Saturday
    const isPast = day.isBefore(dayjs(), 'day'); // Check if the day is in the past

    return (
        <>
            <NewTaskModal isOpen={isOpen} onOpenChange={onOpenChange} defaultDate={newTaskDate} />
            <div
                key={dateStr}
                className={`flex flex-col gap-2 ${isWeekend ? 'bg-content3' : 'bg-content2'} border-1 border-default-200 rounded-xl p-2 min-w-[280px] w-[75vw] sm:w-[50vw] md:w-[20vw] lg:w-[12vw] md flex-shrink-0 snap-center overflow-y-hidden ${isPast ? 'opacity-60' : ''}`}
            >
                <div
                    className={`p-2 border-b-2 ${isToday ? 'border-secondary' : 'border-default'}`}
                >
                    <div className="font-semibold">{day.format('dddd')}</div>
                    <div className="text-sm text-default-500">{day.format('MMM D')}</div>
                </div>
                <Button
                    size="sm"
                    color="primary"
                    variant="light"
                    startContent={<RiAddLine />}
                    className="justify-start"
                    onPress={() => handleNewTask(dateStr)}
                >
                    Add task
                </Button>
                {tasks && (
                    <DraggableList
                        id={dateStr}
                        items={tasks}
                        group="tasks"
                        smallCards
                        onDragEnd={handleDragEnd}
                    />
                )}
            </div>
        </>
    );
};

export default DayColumn;
