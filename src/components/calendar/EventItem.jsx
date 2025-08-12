import { parseToLocal } from '../../utils/dateUtils.js';
import { Card, useDisclosure } from '@heroui/react';
import EventDetailsPopover from './EventDetailsPopover.jsx';

const EventItem = ({ event, isCompact }) => {
    const formatTime = (date) => parseToLocal(date).format('h:mm A');
    const formatShortTime = (date) => parseToLocal(date).format('h:mm');
    const hexColor = event.color.startsWith('#') ? event.color : null;
    const bgColor = hexColor ? `bg-[${hexColor}]` : 'bg-primary-500';

    const { isOpen, onOpenChange } = useDisclosure();

    if (isCompact) {
        return (
            <EventDetailsPopover event={event} isOpen={isOpen} onOpenChange={onOpenChange}>
                <div
                    className={`w-full text-left px-2 rounded-md text-white ${bgColor} border h-6 flex items-center gap-1.5 overflow-hidden shrink-0 cursor-pointer `}
                >
                    <span className="text-xs font-semibold flex-shrink-0">
                        {event.is_all_day ? 'All Day' : formatShortTime(event.start)}
                    </span>
                    <span className="text-xs truncate">{event.title}</span>
                </div>
            </EventDetailsPopover>
        );
    }

    return (
        <EventDetailsPopover event={event} isOpen={isOpen} onOpenChange={onOpenChange}>
            <Card
                isPressable
                className={`w-full text-left p-1 rounded-md text-white ${bgColor} border transition-colors duration-150 cursor-pointer ${isCompact && 'h-6'}`}
            >
                <p className="text-xs font-semibold truncate">
                    {event.is_all_day
                        ? 'All-day'
                        : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                </p>
                <p className="text-sm truncate">{event.title}</p>
            </Card>
        </EventDetailsPopover>
    );
};

export default EventItem;
