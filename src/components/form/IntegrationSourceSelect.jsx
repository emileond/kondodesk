import { useState, useEffect } from 'react';
import CreatableSelect from './CreatableSelect';
import { RiApps2Line } from 'react-icons/ri';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import { useActiveIntegrations } from '../../hooks/react-query/integrations/useUserIntegrations';
import { Avatar } from '@heroui/react';

const IntegrationSourceSelect = ({
    label = 'Integration',
    placeholder = 'Filter by integration...',
    defaultValue = null,
    onChange,
    placement = 'bottom',
    className = '',
    triggerClassName = '',
    disabled = false,
}) => {
    const { data: user } = useUser();
    const [selectedSource, setSelectedSource] = useState(defaultValue);

    // All possible integration options
    const iconClass = 'w-5 h-5';
    const allSourceOptions = [
        {
            label: 'Asana',
            value: 'asana',
            startContent: <Avatar className={iconClass} src="/integrations/asana.png" />,
        },
        {
            label: 'Awork',
            value: 'awork',
            startContent: <Avatar className={iconClass} src="/integrations/awork.png" />,
        },
        {
            label: 'Clickup',
            value: 'clickup',
            startContent: <Avatar className={iconClass} src="/integrations/clickup.png" />,
        },
        {
            label: 'GitHub',
            value: 'github',
            startContent: <Avatar className={iconClass} src="/integrations/github.png" />,
        },
        {
            label: 'Google Tasks',
            value: 'google_tasks',
            startContent: <Avatar className={iconClass} src="/integrations/google_tasks.png" />,
        },
        {
            label: 'Jira',
            value: 'jira',
            startContent: <Avatar className={iconClass} src="/integrations/jira.png" />,
        },
        {
            label: 'MS To Do',
            value: 'microsoft_todo',
            startContent: <Avatar className={iconClass} src="/integrations/microsoft_todo.png" />,
        },
        {
            label: 'Nifty',
            value: 'nifty',
            startContent: <Avatar className={iconClass} src="/integrations/nifty.png" />,
        },
        {
            label: 'Tick tick',
            value: 'ticktick',
            startContent: <Avatar className={iconClass} src="/integrations/ticktick.png" />,
        },
        {
            label: 'Todoist',
            value: 'todoist',
            startContent: <Avatar className={iconClass} src="/integrations/todoist.png" />,
        },
        {
            label: 'Trello',
            value: 'trello',
            startContent: <Avatar className={iconClass} src="/integrations/trello.png" />,
        },
    ];

    // Only fetch active integrations if user_id is provided
    const { data: activeIntegrations, isLoading } = useActiveIntegrations(user?.id);

    // Filter options based on active integrations if user_id is provided
    // Otherwise, show all options
    const sourceOptions =
        user?.id && activeIntegrations?.length
            ? allSourceOptions.filter((option) =>
                  activeIntegrations.some((integration) => integration.type === option.value),
              )
            : allSourceOptions;

    // If there are no active integrations after filtering, show all options
    const finalSourceOptions = sourceOptions.length > 0 ? sourceOptions : allSourceOptions;

    // Update parent component when selected source changes
    useEffect(() => {
        if (onChange) {
            onChange(selectedSource);
        }
    }, [selectedSource, onChange]);

    return (
        <CreatableSelect
            label={label}
            placeholder={placeholder}
            options={finalSourceOptions}
            defaultValue={finalSourceOptions.find((opt) => opt.value === defaultValue)}
            onChange={(value) => {
                const option = finalSourceOptions.find((opt) => opt.value === value);
                setSelectedSource(option?.value || null);
            }}
            placement={placement}
            className={className}
            triggerClassName={triggerClassName}
            disabled={disabled || isLoading}
            icon={<RiApps2Line fontSize="1rem" />}
            onCreate={null} // No creation allowed for integration sources
        />
    );
};

export default IntegrationSourceSelect;
