import { formatTime } from '../../utils/dateUtils.js';
import { useDisclosure } from '@heroui/react';
import EventDetailsPopover from './EventDetailsPopover.jsx';
import { colorContrast } from '../../utils/colorContrast.js';

const EventItem = ({ event, isCompact }) => {
    const hexColor = event.color.startsWith('#') ? event.color : null;
    const bgColor = !hexColor ? 'bg-primary-500' : null;

    const textColor = hexColor ? colorContrast(hexColor, 'y') : '#fff';

    const { isOpen, onOpenChange } = useDisclosure();

    return (
        <EventDetailsPopover event={event} isOpen={isOpen} onOpenChange={onOpenChange}>
            <div
                className={`w-full text-left px-2 rounded-md ${bgColor} ${isCompact ? 'h-6 py-1' : 'h-full py-0'} border flex items-start shrink-0 overflow-hidden cursor-pointer transition-all duration-250`}
                style={{
                    backgroundColor: hexColor,
                    color: textColor,
                    opacity: isOpen ? 0.65 : 0.9,
                }}
            >
                <span className={`text-xs text-wrap truncate`}>
                    <span className="text-xs truncate shrink-0 mr-1">
                        {event.is_all_day ? 'All-day' : `${formatTime(event.start)}`}
                    </span>
                    <span
                        className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium truncate shrink-0`}
                    >
                        {event.title}
                    </span>
                </span>
            </div>
        </EventDetailsPopover>
    );
};

export default EventItem;
