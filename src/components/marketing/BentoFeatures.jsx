import {
    RiGroupLine,
    RiBookletLine,
    RiStackedView,
    RiKanbanView,
    RiPaintBrushLine,
    RiCommandLine,
    RiCalendarScheduleLine,
    RiQuillPenAiLine,
    RiHardDrive3Line,
    RiTimerFlashLine,
} from 'react-icons/ri';
import { BentoGrid, BentoCard } from './BentoGrid.jsx';
import { Image } from '@heroui/react';

function FeaturesGrid() {
    const bentoFeatures = [
        {
            Icon: RiStackedView,
            name: 'Personal backlog',
            description:
                'Keep all your ideas and future tasks organized in one dedicated space, ready when you are.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-backlog.svg',
        },
        {
            Icon: RiBookletLine,
            name: 'Notes',
            description:
                'Jot down quick thoughts, project details, or meeting summaries right alongside your tasks.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-notes.svg',
        },
        {
            Icon: RiGroupLine,
            name: 'Effortless collaboration',
            description:
                'Need to delegate? Assign tasks to others and add guests for easy, focused collaboration.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-collab.svg',
        },
        {
            Icon: RiKanbanView,
            name: 'Flexible views',
            description:
                'Switch between Kanban boards, detailed lists, or comprehensive table views.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: 'User interface',
        },
        {
            Icon: RiCalendarScheduleLine,
            name: 'Auto planning',
            description: 'Weekfuse plans your tasks for you, based on your preferences and goals.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-2',
            background: '/bento-plan.svg',
        },
        {
            Icon: RiPaintBrushLine,
            name: 'Themes',
            description: 'Choose from a variety of themes to match your personal style.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-theme.svg',
        },
        {
            Icon: RiCommandLine,
            name: 'Shortcuts and Command Palette',
            description: 'Quickly access your most used features with a few keystrokes.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-command.svg',
        },
        {
            Icon: RiQuillPenAiLine,
            name: 'Guided reflections',
            description: 'Reflect on your progress, learn and grow with weekly prompts.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-reflect.svg',
        },
        {
            Icon: RiHardDrive3Line,
            name: 'File storage',
            description: 'Save files to your tasks.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-2',
            background: '/bento-storage.svg',
        },
        {
            Icon: RiTimerFlashLine,
            name: 'Productivity tools',
            description:
                'Productivity tools that help you get the most out of your day and avoid burnout.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-pomodoro.svg',
        },
    ];

    return (
        <div className="max-w-6xl mx-auto py-32 px-6">
            <div className="space-y-6 mb-12">
                <h2 className="text-3xl font-bold text-center">Much more than just tasks</h2>
                <p className="text-center text-default-500">
                    Weekfuse is a thoughtfully curated suite of powerful features designed to work
                    together, helping you stay organized, focused, and balanced.
                </p>
            </div>
            <BentoGrid>
                {bentoFeatures.map((feature, idx) => (
                    <BentoCard key={idx} {...feature} />
                ))}
            </BentoGrid>
        </div>
    );
}

export default FeaturesGrid;
