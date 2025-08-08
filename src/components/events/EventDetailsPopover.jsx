import { Popover, PopoverTrigger, PopoverContent, Button, Link } from '@heroui/react';

const EventDetailsPopover = ({ trigger, event }) => {
  if (!event) return trigger || null;
  const {
    title,
    description,
    start_time,
    end_time,
    is_all_day,
    web_link,
    calendar_name,
  } = event;

  return (
    <Popover placement="top" showArrow>
      <PopoverTrigger>{trigger || <Button size="sm" variant="light">Details</Button>}</PopoverTrigger>
      <PopoverContent className="max-w-md p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base">{title || 'Untitled event'}</h4>
            {web_link && (
              <Link href={web_link} target="_blank" rel="noopener noreferrer" size="sm">
                Open
              </Link>
            )}
          </div>
          {calendar_name && <p className="text-xs text-default-500">{calendar_name}</p>}
          <p className="text-sm">
            {is_all_day ? 'All day' : ''}
            {!is_all_day && (
              <>
                <span>{start_time ? new Date(start_time).toLocaleString() : '—'}</span>
                <span className="px-1">–</span>
                <span>{end_time ? new Date(end_time).toLocaleString() : '—'}</span>
              </>
            )}
          </p>
          {description && (
            <div className="prose prose-sm dark:prose-invert max-h-64 overflow-auto" dangerouslySetInnerHTML={{ __html: description }} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EventDetailsPopover;
