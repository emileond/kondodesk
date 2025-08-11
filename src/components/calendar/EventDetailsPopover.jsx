import { Popover, PopoverContent, PopoverTrigger, Button, Link } from '@heroui/react';
import {
    RiAlignItemLeftLine,
    RiAlignLeft,
    RiCalendarLine,
    RiCamera2Line,
    RiCamera3Line,
    RiCameraLine,
    RiExternalLinkLine,
    RiMapPinLine,
    RiText,
    RiVideoChatLine,
    RiVideoOnLine,
    RiWebcamLine,
} from 'react-icons/ri';
import IntegrationSourceIcon from '../tasks/integrations/IntegrationSourceIcon.jsx';

/**
 * A controlled Popover for displaying event details.
 * Its visibility and target are managed by the parent component.
 */
const EventDetailsPopover = ({ event, isOpen, onOpenChange, children }) => {
    if (!event) return null;

    const {
        title,
        description,
        start_time,
        end_time,
        is_all_day,
        web_link,
        calendarName,
        source,
        location_label,
        location_uri,
        meeting_url,
    } = event;

    return (
        <Popover
            placement="top"
            showArrow
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            className="z-50"
        >
            <PopoverTrigger>{children}</PopoverTrigger>
            <PopoverContent className="max-w-md p-5 overflow-x-hidden">
                <div className="w-full flex flex-col gap-6 items-start ">
                    <div className="w-full flex items-start justify-between gap-2">
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

                    {calendarName && (
                        <div className="flex items-start gap-2">
                            <RiCalendarLine className="w-8 text-default-500 text-lg" />
                            <p className="text-sm text-default-foreground font-medium">
                                {calendarName}
                            </p>
                        </div>
                    )}

                    {meeting_url && (
                        <div className="flex items-start gap-2">
                            <RiVideoOnLine className="w-8 text-default-500 text-lg" />
                            <Link
                                className="text-sm text-blue-600 font-medium"
                                isExternal
                                href={meeting_url}
                            >
                                Join Online Meeting
                            </Link>
                        </div>
                    )}

                    {location_label && (
                        <div className="flex items-start gap-2">
                            <RiMapPinLine className="w-8 text-default-500 text-lg" />
                            <Link
                                className="text-sm text-blue-600 font-medium"
                                isExternal
                                showAnchorIcon
                                href={
                                    location_uri
                                        ? location_uri
                                        : location_label.includes('https')
                                          ? location_label
                                          : 'https://maps.google.com/?q=' + location_label
                                }
                            >
                                {location_label}
                            </Link>
                        </div>
                    )}

                    {description && (
                        <div className="flex items-start gap-2">
                            <RiAlignLeft className="w-8 text-default-500 text-lg" />
                            <div
                                className="text-sm prose prose-a:prose-blue dark:prose-invert overflow-auto max-h-64"
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
