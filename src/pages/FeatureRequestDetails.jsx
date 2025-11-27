import NavBar from '../components/marketing/Nav';
import {
    Button,
    Modal,
    ModalContent,
    ModalBody,
    useDisclosure,
    Spinner,
    Divider,
    Input,
    Progress,
} from '@heroui/react';
import Footer from '../components/marketing/Footer.jsx';
import { RiArrowLeftLine, RiArrowUpFill } from 'react-icons/ri';
import {
    useAddFeatureRequestComment,
    useCommentsForFeatureRequest,
    useFeatureRequestItem,
    useVoteOnFeatureRequest,
    useVotesForFeatureRequest,
} from '../hooks/react-query/feature-requests/useFeatureRequests.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import AuthForm from '../components/auth/AuthForm.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState.jsx';
import dayjs from 'dayjs';

function FeatureRequestDetails() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { data: user } = useUser();
    const { data: item, isPending: itemsPending } = useFeatureRequestItem(id);
    const { data: votes, refetch, isFetching } = useVotesForFeatureRequest(id, user?.id);
    const { mutateAsync: voteOnFeatureRequest } = useVoteOnFeatureRequest();
    const { data: comments, isFetching: isFetchingComments } = useCommentsForFeatureRequest(id);
    const { mutateAsync: addFeatureRequestComment } = useAddFeatureRequestComment(id);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const handleVote = async () => {
        if (!user) {
            return onOpen();
        }

        await voteOnFeatureRequest({
            featureRequestId: item?.id,
            userId: user?.id,
            hasVoted: !!votes?.hasVoted,
        });
        await refetch();
    };

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm();

    const onSubmit = async (data) => {
        if (!user) {
            onOpen();
            return;
        }

        try {
            await addFeatureRequestComment({
                comment: data.comment,
                featureRequestId: id,
                user_id: user.id,
            });
            reset();
        } catch (e) {
            console.error(e);
            toast('Failed to save comment', {
                type: 'error',
                icon: '❌',
            });
        }
    };

    return (
        <div className="w-screen min-h-screen bg-content2/50">
            <NavBar />
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalBody>
                        <AuthForm hideLogo onSuccess={() => onOpenChange()} />
                    </ModalBody>
                </ModalContent>
            </Modal>
            <div className="container mx-auto max-w-[860px] px-6 py-16">
                <div className="flex flex-wrap md:flex-nowrap gap-6 pt-12 pb-32">
                    <div className="bg-content1 p-6 rounded-xl border border-content3 basis-2/3 grow min-h-[30vh]">
                        <div className="space-y-3 h-full">
                            {itemsPending && (
                                <div className="flex justify-center items-center h-full">
                                    <Spinner size="lg" />
                                </div>
                            )}
                            {item && (
                                <div>
                                    <Button
                                        size="sm"
                                        variant="light"
                                        color="primary"
                                        onPress={() => navigate(-1)}
                                        startContent={<RiArrowLeftLine fontSize="1rem" />}
                                    >
                                        Back
                                    </Button>
                                    <div className="flex items-start gap-3 py-3">
                                        <div
                                            className="flex flex-col items-center justify-center w-14 h-16 hover:bg-content2 border border-content3 rounded-lg cursor-pointer p-4"
                                            onClick={handleVote}
                                        >
                                            {isFetching ? (
                                                <Spinner size="sm" color="default" />
                                            ) : (
                                                <div
                                                    className={`p-2 text-center text-default-500 ${votes?.hasVoted ? 'text-primary' : 'text-default-600'}`}
                                                >
                                                    <RiArrowUpFill fontSize="1.42rem" />
                                                    {votes?.voteCount || 0}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h1 className="font-semibold mb-3">{item.title}</h1>
                                            <p className="mb-2">{item.description}</p>
                                        </div>
                                    </div>
                                    <Divider />
                                    <div className="my-4 font-medium text-sm text-default-600">
                                        <p>Discussion</p>
                                    </div>
                                    <div>
                                        <form id="comment-form" onSubmit={handleSubmit(onSubmit)}>
                                            <div className="flex gap-3 items-start">
                                                <Input
                                                    placeholder="Leave a comment"
                                                    {...register('comment', {
                                                        required: 'Required field',
                                                    })}
                                                    isInvalid={errors?.comment && true}
                                                    errorMessage={errors?.comment?.message}
                                                />
                                                <Button
                                                    size="md"
                                                    color="primary"
                                                    type="submit"
                                                    form="comment-form"
                                                >
                                                    comment
                                                </Button>
                                            </div>
                                        </form>
                                        {isFetchingComments && (
                                            <Progress
                                                isIndeterminate
                                                aria-label="Loading commentsd"
                                                size="sm"
                                            />
                                        )}
                                        <div className="p-2">
                                            {comments?.length ? (
                                                comments?.map((c) => (
                                                    <div key={c.id} className="py-3">
                                                        <p>{c.comment}</p>
                                                        <span className="text-sm text-default-500">
                                                            {Intl.DateTimeFormat(
                                                                navigator.language,
                                                                {
                                                                    dateStyle: 'medium',
                                                                },
                                                            ).format(new Date(c.created_at))}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <EmptyState
                                                    title="No comments yet"
                                                    description="Got thoughts? Drop a line and start the conversation"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default FeatureRequestDetails;
