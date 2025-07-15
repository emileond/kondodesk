import {
    RiGroupLine,
    RiBookletLine,
    RiStackedView,
    RiKanbanView,
    RiPaintBrushLine,
    RiCommandLine,
    RiCalendarScheduleLine,
    RiQuillPenAiLine,
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
            background: (
                <Image src="/backlog.svg" alt="Backlog UI" width="90%" className="mx-auto" />
            ),
        },
        {
            Icon: RiBookletLine,
            name: 'Notes',
            description:
                'Jot down quick thoughts, project details, or meeting summaries right alongside your tasks.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image src="/notes.png" alt="Collab UI" />,
        },
        {
            Icon: RiGroupLine,
            name: 'Effortless collaboration',
            description:
                'Need to delegate? Assign tasks to others and add guests for easy, focused collaboration.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image src="/collab.svg" alt="Collab UI" />,
        },
        {
            Icon: RiKanbanView,
            name: 'Flexible views',
            description:
                'Switch between Kanban boards, detailed lists, or comprehensive table views.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <img alt="User interface" src="/views.png" />,
        },
        {
            Icon: RiCalendarScheduleLine,
            name: 'Auto planning',
            description: 'Weekfuse plans your tasks for you, based on your preferences and goals.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-2',
            background: <Image src="/planner.svg" alt="Planner" />,
        },
        {
            Icon: RiPaintBrushLine,
            name: 'Themes',
            description: 'Choose from a variety of themes to match your personal style.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image alt="ui themes" src="/themes-ui.png" />,
        },
        {
            Icon: RiCommandLine,
            name: 'Shortcuts and Command Palette',
            description: 'Quickly access your most used features with a few keystrokes.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image alt="command palette" src="/command-palette.png" />,
        },
        {
            Icon: RiQuillPenAiLine,
            name: 'Guided reflections',
            description: 'Reflect on your progress, learn and grow with weekly prompts.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image alt="reflect ui" src="/reflect.png" />,
        },
        {
            Icon: RiQuillPenAiLine,
            name: 'File storage',
            description: 'Save files to your tasks.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-2',
            background: <Image alt="upload files ui" src="/files.png" />,
        },
        {
            Icon: RiQuillPenAiLine,
            name: 'Productivity tools',
            description:
                'Productivity tools that help you get the most out of your day and avoid burnout.',
            href: '#',
            cta: 'Learn more',
            className: 'col-span-3 lg:col-span-1',
            background: <Image alt="reflect ui" src="/productivity-tools.png" />,
        },
    ];

    return (
        <div className="max-w-6xl mx-auto py-32 px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Much more than just tasks</h2>
            <BentoGrid>
                {bentoFeatures.map((feature, idx) => (
                    <BentoCard key={idx} {...feature} />
                ))}
            </BentoGrid>
        </div>
    );
}

export default FeaturesGrid;
