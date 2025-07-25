import { useState, useEffect, useMemo, memo } from 'react';
import { Chip, Spinner } from '@heroui/react';
import {
    RiListCheck3,
    RiFlag2Line,
    RiHashtag,
    RiArrowUpDoubleLine,
    RiArrowDownWideLine,
    RiEqualLine,
    RiAlarmWarningLine,
} from 'react-icons/ri';
import { useProjects } from '../../hooks/react-query/projects/useProjects';
import { useMilestones } from '../../hooks/react-query/milestones/useMilestones';
import { useTags } from '../../hooks/react-query/tags/useTags';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';

// Priority mapping to match PrioritySelect component
const PRIORITY_MAPPING = {
    0: {
        label: 'Low',
        icon: <RiArrowDownWideLine fontSize=".95rem" className="text-blue-500" />,
    },
    1: {
        label: 'Medium',
        icon: <RiEqualLine fontSize=".95rem" className="text-orange-500" />,
    },
    2: {
        label: 'High',
        icon: <RiArrowUpDoubleLine fontSize=".95rem" className="text-danger" />,
    },
};

// Memoized icons
const PROJECT_ICON = <RiListCheck3 fontSize=".95rem" />;
const MILESTONE_ICON = <RiFlag2Line fontSize=".9rem" />;
const TAG_ICON = <RiHashtag fontSize=".9rem" />;
const WARNING_ICON = <RiAlarmWarningLine fontSize=".9rem" />;

// Helper to determine text color based on background for contrast
const getTextColorForBackground = (hexColor) => {
    if (!hexColor || hexColor.length < 7) return '#000000'; // Default to black
    try {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        // Using the YIQ formula to determine brightness
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? '#000000' : '#FFFFFF'; // Black text on light colors, white text on dark colors
    } catch (e) {
        return '#000000';
    }
};

const EntityChip = memo(({ type, entityId, size = 'sm', variant = 'light', className = '' }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const [entityData, setEntityData] = useState(null);
    const [entitiesData, setEntitiesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const isMultiple = useMemo(() => type === 'tag' && Array.isArray(entityId), [type, entityId]);

    const { data: projects, isLoading: isProjectsLoading } = useProjects(
        type === 'project' ? currentWorkspace : null,
    );
    const { data: milestones, isLoading: isMilestonesLoading } = useMilestones(
        type === 'milestone' ? currentWorkspace : null,
    );
    const { data: tags, isLoading: isTagsLoading } = useTags(
        type === 'tag' ? currentWorkspace : null,
    );

    useEffect(() => {
        if (type === 'priority') {
            const priorityValue = parseInt(entityId, 10);
            const priorityInfo = PRIORITY_MAPPING[priorityValue] || {
                label: 'Unknown',
                icon: WARNING_ICON,
            };
            setEntityData({ name: priorityInfo.label, priority: priorityValue });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        if (type === 'project' && projects && !isProjectsLoading) {
            setEntityData(projects.find((p) => p.id === entityId));
            setIsLoading(false);
        } else if (type === 'milestone' && milestones && !isMilestonesLoading) {
            setEntityData(milestones.find((m) => m.id === entityId));
            setIsLoading(false);
        } else if (type === 'tag' && tags && !isTagsLoading) {
            if (isMultiple) {
                setEntitiesData(
                    entityId.map((id) => tags.find((t) => t.id === id)).filter(Boolean),
                );
            } else {
                setEntityData(tags.find((t) => t.id === entityId));
            }
            setIsLoading(false);
        }
    }, [
        type,
        entityId,
        isMultiple,
        projects,
        isProjectsLoading,
        milestones,
        isMilestonesLoading,
        tags,
        isTagsLoading,
    ]);

    const icon = useMemo(() => {
        switch (type) {
            case 'project':
                return PROJECT_ICON;
            case 'milestone':
                return MILESTONE_ICON;
            case 'tag':
                return TAG_ICON;
            case 'priority':
                return entityData
                    ? PRIORITY_MAPPING[entityData.priority]?.icon || WARNING_ICON
                    : WARNING_ICON;
            default:
                return null;
        }
    }, [type, entityData]);

    if (isLoading) {
        return <Spinner size="sm" color="default" />;
    }

    if (isMultiple) {
        if (entitiesData.length === 0) return null;
        return (
            <div className="flex flex-wrap gap-1">
                {entitiesData.map((entity) => (
                    <Chip
                        key={entity.id}
                        size={size}
                        variant="flat"
                        startContent={icon}
                        className={className}
                        style={{
                            backgroundColor: entity.color,
                            color: getTextColorForBackground(entity.color),
                        }}
                    >
                        {entity.name}
                    </Chip>
                ))}
            </div>
        );
    }

    if (!entityData) return null;

    return (
        <Chip size={size} variant={variant} startContent={icon}>
            {entityData.name}
        </Chip>
    );
});

export default EntityChip;
