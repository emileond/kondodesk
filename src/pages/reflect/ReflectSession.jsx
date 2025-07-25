import { useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageLayout from '../../components/layout/PageLayout';
import {
    useReflectSessionById,
    useUpdateReflectSession,
} from '../../hooks/react-query/reflect-sessions/useReflectSessions.js';
import { useForm } from 'react-hook-form';
import {
    Alert,
    Button,
    Textarea,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Divider,
    Chip,
    Tabs,
    Tab,
} from '@heroui/react';
import {
    RiErrorWarningLine,
    RiSparkling2Line,
    RiThumbUpLine,
    RiCalendar2Line,
    RiLightbulbLine,
    RiStarFill,
    RiStarLine,
} from 'react-icons/ri';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateUtils.js';
import ky from 'ky';
import toast from 'react-hot-toast';
import ReflectSessionStatus from '../../components/common/ReflectSessionStatus.jsx';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

function ReflectSessionPage() {
    const { id } = useParams();
    const { data: user } = useUser();
    const { data: session, isLoading, refetch } = useReflectSessionById(id);
    const updateSession = useUpdateReflectSession(user?.id);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState('insights');
    const [rating, setRating] = useState(0);
    const [parent] = useAutoAnimate();

    // Set the active tab based on whether ai_summary exists
    useEffect(() => {
        if (session?.ai_summary) {
            setActiveTab('recommendations');
        } else {
            setActiveTab('insights');
        }
    }, [session?.ai_summary]);

    // Set initial rating from session if available
    useEffect(() => {
        if (session?.feedback_score) {
            setRating(session.feedback_score);
        }
    }, [session?.feedback_score]);

    // Handle rating change
    const handleRatingChange = async (newRating) => {
        setRating(newRating);
        try {
            await updateSession.mutateAsync({
                session_id: id,
                updates: { feedback_score: newRating },
            });
            toast.success('Rating updated successfully');
        } catch (error) {
            console.error('Error updating rating:', error);
            toast.error('Failed to update rating');
            // Revert to previous rating on error
            setRating(session?.feedback_score || 0);
        }
    };

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm({
        defaultValues: {
            went_well: '',
            could_be_better: '',
            ideas: '',
        },
    });

    // Update form values when session data loads
    useEffect(() => {
        if (session?.user_notes) {
            reset({
                went_well: session.user_notes.went_well || '',
                could_be_better: session.user_notes.could_be_better || '',
                ideas: session.user_notes.ideas || '',
            });
        }
    }, [session, reset]);

    const onSubmit = async (formData) => {
        setIsSubmitting(true);
        setSubmitSuccess(false);

        try {
            const userNotes = {
                went_well: formData.went_well,
                could_be_better: formData.could_be_better,
                ideas: formData.ideas,
            };

            // Make a POST request to the new API endpoint using ky
            const response = await ky
                .post('/api/ai/reflect/complete', {
                    json: {
                        session_id: id,
                        ai_insights: session.ai_insights,
                        user_notes: userNotes,
                    },
                    timeout: 180000, // 3 min timeout for AI processing
                })
                .json();

            // Refetch the session data to get the updated ai_summary
            await refetch();
            setSubmitSuccess(true);
            toast.success('Reflection completed successfully');
        } catch (error) {
            console.error('Error completing session:', error);
            toast.error('Failed to complete reflection session');
        } finally {
            setIsSubmitting(false);
        }
    };

    console.log(session);

    // Create custom elements for the page header
    const headerElements = session && (
        <>{session.status && <ReflectSessionStatus status={session.status} size="sm" />}</>
    );

    return (
        <AppLayout>
            <PageLayout
                backBtn
                maxW="screen-xl"
                title={session?.name || 'Reflect session'}
                startElements={!isLoading && headerElements}
                description="Use the insights on the left to guide your thoughts. Fill out what went
                            well and what could improve. Once you save, we'll offer suggestions to
                            help you cultivate balance and intention."
            >
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <p>Loading session data...</p>
                    </div>
                ) : (
                    <div>
                        <div className="flex gap-3 pb-6">
                            {session.start_date && session.end_date && (
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    startContent={<RiCalendar2Line fontSize="1rem" />}
                                >
                                    {formatDate(session.start_date, { dateStyle: 'short' })} -{' '}
                                    {formatDate(session.end_date, { dateStyle: 'short' })}
                                </Chip>
                            )}
                            {session.projects && Array.isArray(session.projects) && (
                                <Chip size="sm" variant="light">
                                    {session.projects.length} projects
                                </Chip>
                            )}
                        </div>
                        <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
                            <Tab key="insights" title="Insights" id="step1">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                                    {/* Left section - AI Insights */}
                                    <Card>
                                        <CardBody className="space-y-3">
                                            <div className="flex gap-3">
                                                {session?.ai_insights?.key_metrics?.total_tasks && (
                                                    <Card className="basis-1/5" shadow="none">
                                                        <CardBody>
                                                            <span className="font-semibold text-xl text-default-600">
                                                                {
                                                                    session.ai_insights.key_metrics
                                                                        .total_tasks
                                                                }
                                                            </span>
                                                        </CardBody>
                                                        <CardFooter className="pt-0">
                                                            <span className="font-medium text-xs text-default-500">
                                                                Tasks completed
                                                            </span>
                                                        </CardFooter>
                                                    </Card>
                                                )}
                                                {session?.ai_insights?.key_metrics
                                                    ?.on_time_percentage && (
                                                    <Card className="basis-1/5" shadow="none">
                                                        <CardBody>
                                                            <span className="font-semibold text-xl text-default-600">
                                                                {
                                                                    session.ai_insights.key_metrics
                                                                        .on_time_percentage
                                                                }
                                                            </span>
                                                        </CardBody>
                                                        <CardFooter className="pt-0">
                                                            <span className="font-medium text-xs text-default-500">
                                                                On-time
                                                            </span>
                                                        </CardFooter>
                                                    </Card>
                                                )}

                                                {session?.ai_insights?.key_metrics
                                                    ?.overdue_tasks !== undefined && (
                                                    <Card className="basis-1/5" shadow="none">
                                                        <CardBody>
                                                            <span className="font-semibold text-xl text-default-600">
                                                                {
                                                                    session.ai_insights.key_metrics
                                                                        .overdue_tasks
                                                                }
                                                            </span>
                                                        </CardBody>
                                                        <CardFooter className="pt-0">
                                                            <span className="font-medium text-xs text-default-500">
                                                                Overdue tasks
                                                            </span>
                                                        </CardFooter>
                                                    </Card>
                                                )}
                                            </div>
                                            <Divider />
                                            <div className="space-y-3">
                                                <h2 className="text-sm font-medium text-default-600">
                                                    Achievements
                                                </h2>
                                                <Card shadow="none">
                                                    <CardBody className="space-y-3">
                                                        {session?.ai_insights?.achievements?.map(
                                                            (item, index) => (
                                                                <Alert
                                                                    key={index}
                                                                    description={item}
                                                                    classNames={{
                                                                        alertIcon: 'text-secondary',
                                                                    }}
                                                                    icon={
                                                                        <RiThumbUpLine fontSize="1.2rem" />
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </CardBody>
                                                </Card>
                                            </div>
                                            <Divider />
                                            <div className="space-y-3">
                                                <h2 className="text-sm font-medium text-default-600">
                                                    Patterns
                                                </h2>
                                                <Card shadow="none">
                                                    <CardBody className="space-y-3">
                                                        {session?.ai_insights?.patterns?.map(
                                                            (item, index) => (
                                                                <Alert
                                                                    key={index}
                                                                    description={item}
                                                                    classNames={{
                                                                        alertIcon: 'text-primary',
                                                                    }}
                                                                    icon={
                                                                        <RiSparkling2Line fontSize="1.2rem" />
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </CardBody>
                                                </Card>
                                            </div>
                                            <Divider />
                                            <div className="space-y-3">
                                                <h2 className="text-sm font-medium text-default-600">
                                                    Challenges
                                                </h2>
                                                <Card shadow="none">
                                                    <CardBody className="space-y-3">
                                                        {session?.ai_insights?.challenges?.map(
                                                            (item, index) => (
                                                                <Alert
                                                                    key={index}
                                                                    description={item}
                                                                    classNames={{
                                                                        alertIcon: 'text-danger',
                                                                    }}
                                                                    icon={
                                                                        <RiErrorWarningLine fontSize="1.2rem" />
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </CardBody>
                                                </Card>
                                            </div>
                                        </CardBody>
                                    </Card>

                                    {/* Right section - User Notes Form */}
                                    <div>
                                        <Card shadow="sm">
                                            <CardHeader>
                                                <h2 className="text-xl font-semibold">
                                                    Your Reflection
                                                </h2>
                                            </CardHeader>
                                            <CardBody>
                                                <form
                                                    onSubmit={handleSubmit(onSubmit)}
                                                    className="space-y-6"
                                                >
                                                    <div className="space-y-2">
                                                        <label
                                                            htmlFor="went_well"
                                                            className="block font-medium"
                                                        >
                                                            What went well?
                                                        </label>
                                                        <Textarea
                                                            id="went_well"
                                                            size="lg"
                                                            placeholder="Enter what went well during this period..."
                                                            {...register('went_well', {
                                                                required: 'This field is required',
                                                            })}
                                                            isInvalid={!!errors.went_well}
                                                            errorMessage={errors.went_well?.message}
                                                            minRows={4}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label
                                                            htmlFor="could_be_better"
                                                            className="block font-medium"
                                                        >
                                                            What could have gone better?
                                                        </label>
                                                        <Textarea
                                                            id="could_be_better"
                                                            size="lg"
                                                            placeholder="Enter what could have gone better..."
                                                            {...register('could_be_better', {
                                                                required: 'This field is required',
                                                            })}
                                                            isInvalid={!!errors.could_be_better}
                                                            errorMessage={
                                                                errors.could_be_better?.message
                                                            }
                                                            minRows={4}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label
                                                            htmlFor="ideas"
                                                            className="block font-medium"
                                                        >
                                                            Ideas for improvement
                                                        </label>
                                                        <Textarea
                                                            id="ideas"
                                                            size="lg"
                                                            placeholder="Enter your ideas for improvement..."
                                                            {...register('ideas', {
                                                                required: 'This field is required',
                                                            })}
                                                            isInvalid={!!errors.ideas}
                                                            errorMessage={errors.ideas?.message}
                                                            minRows={4}
                                                        />
                                                    </div>

                                                    {submitSuccess && (
                                                        <div className="p-3 bg-green-100 text-green-700 rounded-md">
                                                            Your reflection has been saved
                                                            successfully!
                                                        </div>
                                                    )}

                                                    <Button
                                                        type="submit"
                                                        color="primary"
                                                        isLoading={isSubmitting}
                                                        className="w-full"
                                                    >
                                                        Save Reflection
                                                    </Button>
                                                </form>
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </Tab>

                            {session?.ai_summary && (
                                <Tab key="recommendations" title="Recommendations">
                                    <div className="flex justify-center mt-4 mb-12">
                                        <Card className="max-w-3xl p-3" shadow="sm">
                                            <div className="h-64">
                                                <DotLottieReact
                                                    src="/lottie/sun.lottie"
                                                    autoplay
                                                    loop
                                                />
                                            </div>
                                            <CardHeader>
                                                <h2 className="font-semibold text-md text-default-800">
                                                    Reflect session complete
                                                </h2>
                                            </CardHeader>
                                            <CardBody className="space-y-3">
                                                <p className="text-default-500">
                                                    {session.ai_summary.summary}
                                                </p>
                                                {session.ai_summary.recommendations && (
                                                    <h3 className="text-sm text-default-800 py-3">
                                                        Recommendations
                                                    </h3>
                                                )}
                                                {session.ai_summary.recommendations?.map(
                                                    (recommendation, index) => (
                                                        <Alert
                                                            variant="faded"
                                                            key={index}
                                                            classNames={{
                                                                alertIcon: 'text-primary',
                                                            }}
                                                            icon={
                                                                <RiLightbulbLine fontSize="1.2rem" />
                                                            }
                                                            title={
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    {recommendation.title}
                                                                    <Chip
                                                                        size="sm"
                                                                        variant="faded"
                                                                        color="primary"
                                                                    >
                                                                        {recommendation.category}
                                                                    </Chip>
                                                                </div>
                                                            }
                                                            description={recommendation.description}
                                                        />
                                                    ),
                                                )}
                                            </CardBody>
                                            <CardFooter>
                                                <div className="w-full flex flex-col gap-3 items-center justify-center py-9">
                                                    <p className="text-sm text-default-500 font-medium">
                                                        How useful was this?
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() =>
                                                                    handleRatingChange(star)
                                                                }
                                                                className="text-2xl focus:outline-none transition-colors"
                                                                aria-label={`Rate ${star} stars`}
                                                            >
                                                                {star <= rating ? (
                                                                    <RiStarFill className="text-warning-500" />
                                                                ) : (
                                                                    <RiStarLine className="text-gray-300 hover:text-warning-500" />
                                                                )}
                                                            </button>
                                                        ))}
                                                        {rating > 0 && (
                                                            <span className="ml-2 text-sm text-default-500">
                                                                {rating}/5
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    </div>
                                </Tab>
                            )}
                        </Tabs>
                    </div>
                )}
            </PageLayout>
        </AppLayout>
    );
}

export default ReflectSessionPage;
