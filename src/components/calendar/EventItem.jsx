import { formatTime } from '../../utils/dateUtils.js';
import { Card, useDisclosure } from '@heroui/react';
import EventDetailsPopover from './EventDetailsPopover.jsx';
import { colorContrast } from '../../utils/colorContrast.js';

const EventItem = ({ event, isCompact }) => {
    const hexColor = event.color.startsWith('#') ? event.color : null;
    const bgColor = !hexColor ? 'bg-primary-500' : null;

    const textColor = hexColor ? colorContrast(hexColor, 'y') : '#fff';

    const { isOpen, onOpenChange } = useDisclosure();

    if (isCompact) {
        return (
            <EventDetailsPopover event={event} isOpen={isOpen} onOpenChange={onOpenChange}>
                <div
                    className={`w-full text-left px-2 rounded-md ${bgColor} border h-6 flex items-center gap-1.5 overflow-hidden shrink-0 cursor-pointer `}
                    style={{
                        backgroundColor: hexColor,
                        color: textColor,
                    }}
                >
                    <span className="text-xs font-semibold flex-shrink-0">
                        {event.is_all_day
                            ? 'All Day'
                            : `${formatTime(event.start)} - ${formatTime(event.end)}`}
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
                className={`w-full text-left p-1 rounded-md ${bgColor} border transition-colors duration-150 cursor-pointer ${isCompact && 'h-6'}`}
                style={{
                    backgroundColor: hexColor,
                    color: textColor,
                }}
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
