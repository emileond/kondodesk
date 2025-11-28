import { useState, useEffect } from 'react';
import ProfileStep from './ProfileStep.jsx';
import WorkspaceNameStep from './WorkspaceNameStep';
import PlanningStep from './PlanningStep.jsx';
import IntegrationsStep from './IntegrationsStep.jsx';
import CompletionStep from './CompletionStep';
import ThemeStep from './ThemeStep';
import { Card, CardBody, CardFooter, Progress } from '@heroui/react';
import { useAutoAnimate } from '@formkit/auto-animate/react';

function OnboardingSteps({ userProfile, currentWorkspace, setCurrentWorkspace }) {
    const [parent] = useAutoAnimate();
    // Track current step by ID instead of index
    const [currentStepId, setCurrentStepId] = useState('welcome');

    // Define steps and their visibility conditions
    const steps = [
        {
            id: 'welcome',
            title: 'Bienvenido a Kondodesk,',
            description:
                'Nos alegra que estés aquí. Necesitamos algunos datos para personalizar tu experiencia.',
            component: ProfileStep,
            isVisible: () => !userProfile?.name,
        },
        {
            id: 'workspace',
            title: "Let's set up your workspace",
            description:
                'A workspace is a dedicated area for your tasks. What should we call yours?',
            component: WorkspaceNameStep,
            isVisible: () => false,
        },
        {
            id: 'integrations',
            title: 'Bring your tasks together',
            description:
                'Connect your tools to see everything in one place. You can always do this later.',
            component: IntegrationsStep,
            isVisible: () => false, // Always visible
        },
        {
            id: 'planning',
            title: 'Find your planning rhythm',
            description:
                'A weekly planning ritual is key to a balanced week. When is a good time for you to plan?',
            component: PlanningStep,
            isVisible: () => false, // Always visible
        },
        {
            id: 'theme',
            title: 'Choose your theme',
            description: 'Select your favorite theme',
            component: ThemeStep,
            isVisible: () => false, // Always visible
        },
        {
            id: 'completion',
            title: "You're All Set! ",
            description: 'Your workspace is ready',
            component: CompletionStep,
            isVisible: () => true, // Always visible
        },
    ];

    // Get only the visible steps
    const visibleSteps = steps.filter((step) => step.isVisible());

    // Ensure currentStepId is always pointing to a valid step
    useEffect(() => {
        if (!visibleSteps.find((step) => step.id === currentStepId)) {
            // Find the next available step in the ordered list
            const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);
            const nextVisibleStep = visibleSteps.find(
                (step) => steps.findIndex((s) => s.id === step.id) > currentStepIndex,
            );

            setCurrentStepId(nextVisibleStep ? nextVisibleStep.id : visibleSteps[0]?.id);
        }
    }, [visibleSteps.length, currentStepId]);

    // Get the current step
    const currentStep = visibleSteps.find((step) => step.id === currentStepId);

    // Move to the next step based on the original step order
    const goToNextStep = () => {
        const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);
        const nextStep = visibleSteps.find(
            (step) => steps.findIndex((s) => s.id === step.id) > currentStepIndex,
        );

        if (nextStep) {
            setCurrentStepId(nextStep.id);
        }
    };

    // If no steps are visible, return null
    if (!currentStep) return null;

    const StepComponent = currentStep.component;

    return (
        <Card shadow="none" className="p-3 bg-transparent max-w-lg mx-auto">
            <CardBody>
                <div className="min-h-[60vh] flex flex-col gap-6 text-center" ref={parent}>
                    <div className="mb-6">
                        <h1 className="text-3xl font-semibold mb-6">{currentStep.title}</h1>
                        <p className="text-default-600 text-pretty">{currentStep.description}</p>
                    </div>
                    <StepComponent
                        currentWorkspace={currentWorkspace}
                        setCurrentWorkspace={setCurrentWorkspace}
                        goToNextStep={goToNextStep}
                    />
                </div>
            </CardBody>
            <CardFooter>
                <div className="flex items-center justify-center w-[280px] mx-auto">
                    <div className="grow flex gap-4 items-center justify-around py-3">
                        {steps.map((step, index) => (
                            <Progress
                                key={index}
                                size="sm"
                                color="secondary"
                                value={
                                    index >= steps.findIndex((step) => step.id === currentStepId)
                                        ? 0
                                        : 100
                                }
                            />
                        ))}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}

export default OnboardingSteps;
