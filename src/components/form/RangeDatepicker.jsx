import { Popover, PopoverTrigger, PopoverContent, Button, Divider } from '@heroui/react';
import dayjs from 'dayjs';
import { useState, useMemo, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { RiCalendarEventLine, RiArrowGoForwardLine } from 'react-icons/ri';

const RangeDatepicker = ({
    defaultValue,
    trigger,
    placement = 'bottom',
    onChange,
    maxDays = 30,
    preset,
}) => {
    const getDefaultDateRange = () => {
        if (defaultValue) return defaultValue;
        const to = dayjs().add(13, 'day').endOf('day').toDate();
        const from = dayjs().startOf('day').toDate();
        return { from, to };
    };

    const [dateRange, setDateRange] = useState(getDefaultDateRange());
    const [isOpen, setIsOpen] = useState(false);

    const triggerText = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return 'Select date range';

        // Use Intl.DateTimeFormat for locale-aware short date formatting
        const formatter = new Intl.DateTimeFormat(navigator.language, {
            dateStyle: 'medium',
        });

        const fromDate = formatter.format(new Date(dateRange.from));
        const toDate = formatter.format(new Date(dateRange.to));

        return `${fromDate} - ${toDate}`;
    }, [dateRange]);

    useEffect(() => {
        // We only call onChange when the dateRange is fully formed.
        if (onChange && dateRange?.from && dateRange?.to) {
            onChange(dateRange);
        }
    }, [dateRange, onChange]);

    const handleDaySelect = (range) => {
        if (range?.from && range?.to) {
            const start = dayjs(range.from);
            const end = dayjs(range.to);
            if (end.diff(start, 'day') >= maxDays) {
                setDateRange({ from: range.from, to: undefined });
                return;
            }
        }
        setDateRange(range);
    };

    const handlePresetClick = () => {
        if (!preset) return;
        const from = dayjs().startOf('day').toDate();
        const to = dayjs()
            .add(preset.days - 1, 'day')
            .endOf('day')
            .toDate();
        setDateRange({ from, to });
        setIsOpen(false); // Close popover after selection
    };

    const disabledDays = useMemo(() => {
        if (dateRange?.from && !dateRange?.to) {
            return {
                before: dayjs(dateRange.from).subtract(maxDays, 'day').toDate(),
                after: dayjs(dateRange.from).add(maxDays, 'day').toDate(),
            };
        }
        return [];
    }, [dateRange, maxDays]);

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
                    {preset && (
                        <>
                            <Button
                                size="sm"
                                className="w-full text-default-600"
                                variant="light"
                                startContent={<RiArrowGoForwardLine fontSize="1rem" />}
                                onPress={handlePresetClick}
                            >
                                {preset.label}
                            </Button>
                            <Divider />
                        </>
                    )}
                    <DayPicker
                        mode="range"
                        selected={dateRange}
                        onSelect={handleDaySelect}
                        disabled={disabledDays}
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

export default RangeDatepicker;
