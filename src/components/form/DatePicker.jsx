import { Popover, PopoverTrigger, PopoverContent, Button, Divider } from '@heroui/react';
import dayjs from 'dayjs';
import { useState, useMemo, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { RiCalendarEventLine, RiArchiveStackLine } from 'react-icons/ri';

const DatePicker = ({ value, defaultValue, trigger, placement = 'bottom', onChange }) => {
    // Initialize state from props, prioritizing the controlled `value`
    const [selectedDate, setSelectedDate] = useState(value !== undefined ? value : defaultValue);
    const [isOpen, setIsOpen] = useState(false);

    // 💡 KEY FIX: This effect syncs the internal state with the `value` prop from the parent.
    // This is crucial for when you switch tasks in the modal.
    useEffect(() => {
        // We check `value !== undefined` to allow the component to handle `null` (for "Backlog") as a valid value.
        if (value !== undefined) {
            setSelectedDate(value);
        }
    }, [value]); // The dependency array ensures this runs ONLY when the parent's `value` prop changes.

    const handleDateChange = (newDate) => {
        // Update the internal state immediately for a responsive UI
        setSelectedDate(newDate);

        // Notify the parent component of the change
        if (onChange) {
            onChange(newDate);
        }
        // Close the popover after a selection is made
        setIsOpen(false);
    };

    const triggerText = useMemo(() => {
        if (!selectedDate) return 'Backlog';

        const today = dayjs();
        const tomorrow = today.add(1, 'day');

        if (dayjs(selectedDate).isSame(today, 'day')) {
            return 'Today';
        } else if (dayjs(selectedDate).isSame(tomorrow, 'day')) {
            return 'Tomorrow';
        } else {
            return new Intl.DateTimeFormat(navigator.language, {
                dateStyle: 'medium',
            }).format(new Date(selectedDate));
        }
    }, [selectedDate]);

    return (
        <Popover placement={placement} isOpen={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                {trigger || (
                    <Button
                        size="sm"
                        variant="light"
                        className="text-default-600"
                        startContent={<RiCalendarEventLine fontSize="1rem" />}
                        onPress={() => setIsOpen(true)}
                    >
                        {triggerText}
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <div className="flex flex-col gap-1 p-2">
                    <Button
                        size="sm"
                        className="w-full text-default-600"
                        variant="light"
                        startContent={<RiArchiveStackLine fontSize="1rem" />}
                        onPress={() => handleDateChange(null)} // Use the new handler
                    >
                        Add to backlog
                    </Button>
                    <Divider />
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onDayClick={handleDateChange} // Use the new handler
                        // (rest of your classNames props)
                        classNames={{
                            months: 'relative flex flex-wrap justify-center gap-8',
                            month_caption:
                                'flex items-center font-medium text-md h-9 px-2 text-default-800',
                            nav: 'absolute inset-x-0 flex justify-end items-center h-9 gap-2',
                            button_next:
                                'relative inline-flex items-center justify-center size-8 hover:bg-default-100 rounded',
                            button_previous:
                                'relative inline-flex items-center justify-center size-8 hover:bg-default-100 rounded',
                            calendar: 'relative text-sm',
                            chevron: 'inline-block size-7 fill-gray-400',
                            week: 'grid grid-cols-7',
                            weekdays: 'grid grid-cols-7',
                            weekday:
                                'size-8 flex items-center justify-center text-default-500 font-normal',
                            day: '*:h-[36px] *:w-[36px] inline-flex items-center justify-center rounded text-gray-700 hover:bg-default-200 size-9 font-normal aria-selected:opacity-100 cursor-pointer',
                            today: 'bg-default-200 font-semibold',
                            selected:
                                'bg-primary text-white hover:bg-primary-500 hover:text-white focus:bg-primary-500 focus:text-white',
                            outside: 'text-gray-500 opacity-50 ',
                            disabled: 'text-gray-500 opacity-50 cursor-auto',
                            range_middle:
                                'aria-selected:bg-primary-50 aria-selected:text-gray-900 aria-selected:hover:bg-blue-200 rounded-none ',
                            hidden: 'invisible',
                        }}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default DatePicker;
