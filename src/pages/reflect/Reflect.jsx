import AppLayout from '../../components/layout/AppLayout';
import PageLayout from '../../components/layout/PageLayout';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import {
    useReflectSessions,
    useCreateReflectSession,
} from '../../hooks/react-query/reflect-sessions/useReflectSessions.js';
import {
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Divider,
    Alert,
    Chip,
} from '@heroui/react';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import { RiAddFill, RiLightbulbLine } from 'react-icons/ri';
import RangeDatepicker from '../../components/form/RangeDatepicker.jsx';
import ProjectSelect from '../../components/form/ProjectSelect.jsx';
import { toUTC } from '../../utils/dateUtils.js';
import { useNavigate } from 'react-router-dom';
import ReflectSessionCard from './ReflectSessionCard.jsx';
import FeatureCarousel from '../../components/onboarding/FeatureCarousel.jsx';
import AnimatedInsights from '../../components/marketing/AnimatedInsights.jsx';

function ReflectPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: user } = useUser();
    const navigate = useNavigate();
    const { data: reflectSessionsData } = useReflectSessions(user?.id); // Renamed to avoid conflict
    const { mutate: createReflectSession, isPending } = useCreateReflectSession(user?.id);

    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [showCarousel, setShowCarousel] = useState(false);

    // Define features for the carousel
    const carouselFeatures = [
        {
            title: 'Welcome to Reflect',
            description:
                'Go beyond your to-do list. Reflect helps you understand how you work, celebrating wins and uncovering hidden patterns.',
            content: <AnimatedInsights />,
        },
        {
            title: 'Connect the Dots',
            description:
                'We provide the data, you provide the context. Combine stats with your own thoughts to create a complete picture of your progress.',
            content: (
                <div className="p-6 space-y-6 text-left bg-content2 rounded-xl">
                    <div>
                        <h5 className="font-semibold text-default-800">Your Insights</h5>
                        <p className="text-sm text-default-600">✓ 25% more tasks on Wednesdays</p>
                    </div>
                    <div>
                        <h5 className="font-semibold text-default-800">Your Thoughts</h5>
                        <div className="w-full p-3 mt-1 text-sm text-left border rounded-lg bg-background border-default-200 text-default-500">
                            "Felt really focused this week. The new project is energizing..."
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'From Reflection to Action',
            description:
                'Our AI synthesizes everything into a clear summary with personalized, actionable recommendations to help you grow.',
            content: (
                <div className="space-y-3 scale-90">
                    <Alert
                        className="bg-content3"
                        variant="faded"
                        classNames={{
                            alertIcon: 'text-primary',
                        }}
                        icon={<RiLightbulbLine fontSize="1.2rem" />}
                        title={
                            <div className="flex items-center gap-3 mb-1">
                                Plan Tomorrow, Tonight
                                <Chip size="sm" variant="faded" color="primary">
                                    Planning
                                </Chip>
                            </div>
                        }
                        description="End your day by outlining your top 3 priorities for tomorrow to start with clarity."
                    />
                    <Alert
                        className="bg-content3"
                        variant="faded"
                        classNames={{
                            alertIcon: 'text-primary',
                        }}
                        icon={<RiLightbulbLine fontSize="1.2rem" />}
                        title={
                            <div className="flex items-center gap-3 mb-1">
                                Try the 25-Minute Focus
                                <Chip size="sm" variant="faded" color="primary">
                                    Focus
                                </Chip>
                            </div>
                        }
                        description="Work in focused 25-minute sprints followed by a 5-minute break to maintain energy."
                    />
                </div>
            ),
        },
    ];

    // Check if this is the first visit to the Reflect page
    useEffect(() => {
        const hasVisitedReflect = localStorage.getItem('hasVisitedReflect');
        if (!hasVisitedReflect) {
            setShowCarousel(true);
        }
    }, []);

    // Handle carousel close
    const handleCarouselClose = () => {
        setShowCarousel(false);
        localStorage.setItem('hasVisitedReflect', 'true');
    };

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm();

    // --- REFACTORED onSubmit FUNCTION ---
    const onSubmit = () => {
        if (!dateRange.from || !dateRange.to) {
            toast.error('Please select a date range');
            return;
        }

        const payload = {
            start_date: toUTC(dateRange.from),
            end_date: toUTC(dateRange.to),
            projects: selectedProjects,
            user_id: user.id,
            workspace_id: currentWorkspace?.workspace_id,
        };

        createReflectSession(payload, {
            onSuccess: (newSession) => {
                toast.success('Reflection session created successfully');
                // The invalidation happens automatically via the hook's onSuccess.
                // We just need to navigate.
                navigate(`/reflect/session/${newSession.id}`);
                onClose();
                reset();
            },
            onError: (error) => {
                toast.error(error.message || 'Failed to create reflection session');
            },
        });
    };

    return (
        <AppLayout>
            {showCarousel && (
                <FeatureCarousel
                    features={carouselFeatures}
                    onClose={handleCarouselClose}
                    backgroundImage="/images/reflect-bg.jpg"
                />
            )}
            <PageLayout
                title="Reflect"
                maxW="3xl"
                primaryAction="New session"
                icon={<RiAddFill fontSize="1.2rem" />}
                description="Understand your progress and identify opportunities for improvement with AI-powered retrospectives."
                onClick={onOpen}
            >
                <div className="flex flex-col gap-3 mb-12">
                    {reflectSessionsData?.length ? (
                        reflectSessionsData.map((session) => (
                            <ReflectSessionCard key={session?.id} session={session} />
                        ))
                    ) : (
                        <EmptyState
                            title="No reflect sessions yet"
                            description="Start a new session to gain insights from your completed tasks and projects."
                            primaryAction="Start new session"
                            onClick={onOpen}
                        />
                    )}
                </div>
                <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                    <ModalContent>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                onSubmit();
                            }}
                        >
                            <ModalHeader className="flex flex-col gap-1">
                                Start a reflection session
                            </ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <p className="font-medium text-sm text-gray-700">
                                            Timeframe
                                        </p>
                                        <p className="text-default-500 text-xs">
                                            Choose the period you&#39;d like to focus on.
                                        </p>
                                        <div className="mt-1">
                                            <RangeDatepicker onChange={setDateRange} />
                                        </div>
                                    </div>
                                    <Divider />
                                    <div className="flex flex-col gap-2">
                                        <p className="font-medium text-sm text-gray-700">
                                            Projects
                                        </p>
                                        <p className="text-default-500 text-xs">
                                            Select specific projects, or leave blank to review
                                            everything.
                                        </p>
                                        <div className="mt-1">
                                            <ProjectSelect
                                                multiSelect
                                                onChange={setSelectedProjects}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose} isDisabled={isPending}>
                                    Cancel
                                </Button>
                                <Button color="primary" type="submit" isLoading={isPending}>
                                    Start session
                                </Button>
                            </ModalFooter>
                        </form>
                    </ModalContent>
                </Modal>
            </PageLayout>
        </AppLayout>
    );
}

export default ReflectPage;
