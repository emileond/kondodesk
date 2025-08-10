import { Popover, PopoverContent, PopoverTrigger, Button, Link } from '@heroui/react';
import {
    RiAlignItemLeftLine,
    RiAlignLeft,
    RiCalendarLine,
    RiExternalLinkLine,
    RiText,
} from 'react-icons/ri';
import IntegrationSourceIcon from '../tasks/integrations/IntegrationSourceIcon.jsx';

/**
 * A controlled Popover for displaying event details.
 * Its visibility and target are managed by the parent component.
 */
const EventDetailsPopover = ({ event, isOpen, onOpenChange, children }) => {
    if (!event) return null;

    const { title, description, start_time, end_time, is_all_day, web_link, calendarName, source } =
        event;

    return (
        <Popover
            placement="top"
            showArrow
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            className="z-50"
        >
            <PopoverTrigger>{children}</PopoverTrigger>
            <PopoverContent className="max-w-md p-3">
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="space-y-2">
                                <IntegrationSourceIcon type={source} />
                                <h4 className="font-semibold text-base">
                                    {title || 'Untitled event'}
                                </h4>
                            </div>
                            <p className="text-sm text-default-500">
                                {is_all_day ? 'All day' : ''}
                                {!is_all_day && (
                                    <>
                                        <span>
                                            {start_time
                                                ? Intl.DateTimeFormat(navigator.language, {
                                                      timeStyle: 'short',
                                                      dateStyle: 'long',
                                                  }).format(new Date(start_time))
                                                : '—'}
                                        </span>
                                        <span className="px-1">–</span>
                                        <span>
                                            {end_time
                                                ? Intl.DateTimeFormat(navigator.language, {
                                                      timeStyle: 'short',
                                                  }).format(new Date(end_time))
                                                : '—'}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                        {web_link && (
                            <div>
                                <Link
                                    href={web_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    isExternal
                                    showAnchorIcon
                                    className="text-sm"
                                >
                                    Open
                                </Link>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-3 py-3">
                        {calendarName && (
                            <div className="flex items-center gap-2">
                                <RiCalendarLine className="text-default-500 text-lg" />
                                <p className="text-sm text-default-foreground font-medium">
                                    {calendarName}
                                </p>
                            </div>
                        )}
                    </div>
                    {description && (
                        <div className="flex items-center gap-2">
                            <RiAlignLeft className="text-default-500 text-lg" />
                            <div
                                className="text-sm prose prose-sm dark:prose-invert max-h-48 overflow-auto"
                                dangerouslySetInnerHTML={{ __html: description }}
                            />
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default EventDetailsPopover;
