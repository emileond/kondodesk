import { Chip, Link, Progress, Spinner, User } from '@heroui/react';
import { RiHashtag, RiPriceTag3Line, RiTimerLine } from 'react-icons/ri';
import { colorContrast } from '../../../../utils/colorContrast.js';
import useCurrentWorkspace from '../../../../hooks/useCurrentWorkspace.js';
import { useNiftyTaskDetails } from '../../../../hooks/react-query/integrations/nifty/useNiftyTaskDetails.js';

const NiftyTaskDetails = ({ external_data }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: niftyDetails, isLoading } = useNiftyTaskDetails(
        external_data?.id,
        currentWorkspace?.workspace_id,
    );

    console.log(niftyDetails);

    // Use fetched data, with fallbacks to external_data if needed
    const project = niftyDetails?.project;
    const milestone = niftyDetails?.milestone;
    const tags = niftyDetails?.tags;
    const assignees = niftyDetails?.assignees ?? [];

    return isLoading ? (
        <div className="flex flex-col items-center gap-2">
            <Spinner size="sm" />
        </div>
    ) : (
        <>
            {project && (
                <div className="flex flex-col gap-1">
                    <Chip
                        color="default"
                        className="text-default-600"
                        size="sm"
                        variant="light"
                        startContent={<RiPriceTag3Line fontSize=".9rem" />}
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Project
                    </Chip>
                    <Link
                        className="text-foreground text-sm"
                        isExternal
                        href={`https://nifty.pm/projects/${project?.id}/task`}
                    >
                        {project?.name}
                    </Link>
                </div>
            )}
            {milestone && (
                <div className="flex flex-col gap-1">
                    <Chip
                        color="default"
                        className="text-default-600"
                        size="sm"
                        variant="light"
                        startContent={<RiPriceTag3Line fontSize=".9rem" />}
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Milestone
                    </Chip>
                    <span className="text-foreground text-sm">{milestone?.name}</span>
                </div>
            )}
            {tags && (
                <div className="flex flex-col gap-1">
                    <Chip
                        size="sm"
                        color="default"
                        className="text-default-600"
                        variant="light"
                        startContent={<RiPriceTag3Line fontSize=".9rem" />}
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Tags
                    </Chip>
                    <div className="flex flex-wrap gap-1">
                        {tags.map((label) => (
                            <Chip
                                key={label.id}
                                size="sm"
                                style={{
                                    background: `${label?.color}`,
                                    color: colorContrast(label?.color, 'y'),
                                }}
                            >
                                {label?.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}
            {external_data?.story_points && (
                <div className="flex flex-col gap-1">
                    <Chip
                        color="default"
                        className="text-default-700"
                        size="sm"
                        variant="light"
                        startContent={<RiHashtag fontSize=".9rem" />}
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Story points
                    </Chip>
                    <span className="text-sm text-foreground">{external_data?.story_points}</span>
                </div>
            )}
            {external_data?.tracked_time && (
                <div className="flex flex-col gap-1">
                    <Chip
                        color="default"
                        className="text-default-700"
                        size="sm"
                        variant="light"
                        startContent={<RiTimerLine fontSize=".9rem" />}
                        classNames={{
                            content: 'font-medium',
                        }}
                    >
                        Tracked time
                    </Chip>
                    <span className="text-sm text-foreground">
                        {Intl.DateTimeFormat(navigator.language, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'UTC',
                            hour12: false,
                        }).format(external_data?.tracked_time)}
                    </span>
                </div>
            )}
            <div className="flex flex-col gap-1 items-start">
                <label className="text-sm">Assignees</label>
                {assignees?.map((member) => (
                    <User
                        key={member?.id}
                        name={member?.name || member?.email}
                        avatarProps={{
                            src: member?.avatar_url,
                            size: 'sm',
                            className: 'w-6 h-6 text-tiny',
                            name: member?.initials,
                        }}
                    />
                ))}
            </div>
        </>
    );
};

export default NiftyTaskDetails;
