import { Card, CardBody, Chip, Spinner } from '@heroui/react';
import { RiArrowUpFill, RiCircleFill } from 'react-icons/ri';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import {
    useVotesForFeatureRequest,
    useVoteOnFeatureRequest,
} from '../../hooks/react-query/feature-requests/useFeatureRequests.js';
import { useNavigate } from 'react-router-dom';

function FeatureRequestCard({ item, isRoadmapCard, onAnonUserVote }) {
    const { data: user } = useUser();
    const { data: votes, refetch, isFetching } = useVotesForFeatureRequest(item?.id, user?.id);
    const { mutateAsync: voteOnFeatureRequest } = useVoteOnFeatureRequest(item?.id);
    const navigate = useNavigate();

    const handleVote = async () => {
        if (!user) {
            onAnonUserVote?.(true);
            return;
        }

        console.log('voting', !!votes?.hasVoted);

        await voteOnFeatureRequest({
            featureRequestId: item?.id,
            userId: user?.id,
            hasVoted: !!votes?.hasVoted,
        });
        await refetch();
    };

    const handleNavigate = () => {
        return navigate(`/feature-requests/${item?.id}`);
    };

    const statusList = [
        { key: 'idea', color: 'text-default-400' },
        { key: 'planned', color: 'text-primary-400' },
        { key: 'in progress', color: 'text-blue-400' },
        { key: 'done', color: 'text-success-400' },
    ];

    return (
        <Card
            shadow="none"
            className="border border-content3  hover:bg-content2/50 transition-bg duration-300 ease-in-out"
        >
            <CardBody className="p-0">
                <div className="flex items-start gap-0 h-32">
                    <div
                        className="flex flex-col justify-center w-14 hover:bg-content2 cursor-pointer p-4 border-r border-content3 h-full"
                        onClick={handleVote}
                    >
                        {isFetching ? (
                            <Spinner size="sm" color="default" />
                        ) : (
                            <div
                                className={`p-2 self-center text-center text-default-500 ${votes?.hasVoted ? 'text-primary' : 'text-default-500'}`}
                            >
                                <RiArrowUpFill fontSize="1.42rem" />
                                {votes?.voteCount || 0}
                            </div>
                        )}
                    </div>
                    <div className="w-full p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <h4
                                className="font-medium cursor-pointer hover:text-primary"
                                onClick={handleNavigate}
                            >
                                {item.title}
                            </h4>
                            <Chip
                                size="sm"
                                variant="light"
                                key={item.key}
                                startContent={
                                    <RiCircleFill
                                        className={
                                            statusList.find((status) => item?.status === status.key)
                                                ?.color
                                        }
                                    />
                                }
                            >
                                {item?.status}
                            </Chip>
                        </div>
                        {isRoadmapCard ? (
                            <p className="text-sm text-default-500 line-clamp-3">
                                {item.description}
                            </p>
                        ) : (
                            <p className="text-default-500 line-clamp-4">{item.description}</p>
                        )}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

export default FeatureRequestCard;
