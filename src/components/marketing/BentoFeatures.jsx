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
            name: 'Reservas de amenidades',
            description:
                'Reserva gimnasio, canchas, salones y terrazas sin choques de horario.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-backlog.svg',
        },
        {
            Icon: RiBookletLine,
            name: 'Avisos y comunicados',
            description:
                'Publica anuncios y reglamentos para mantener a todos informados desde un solo lugar.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-notes.svg',
        },
        {
            Icon: RiGroupLine,
            name: 'Roles y permisos',
            description:
                'Define administradores, conserjes y residentes. Controla quién puede reservar, aprobar o publicar avisos.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-collab.svg',
        },
        {
            Icon: RiKanbanView,
            name: 'Calendario por amenidad',
            description:
                'Visualiza disponibilidad por día y por amenidad para evitar choques de horario.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: 'User interface',
        },
        {
            Icon: RiCalendarScheduleLine,
            name: 'Aprobaciones y reglas',
            description: 'Configura horarios, aforos, reglas y aprobaciones por amenidad.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-2',
            background: '/bento-plan.svg',
        },
        {
            Icon: RiPaintBrushLine,
            name: 'Reglamento y aforos',
            description: 'Define reglas, aforos y horarios bloqueados por amenidad.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-theme.svg',
        },
        {
            Icon: RiCommandLine,
            name: 'Accesos rápidos',
            description: 'Accede en segundos a funciones clave con atajos y comandos.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-command.svg',
        },
        {
            Icon: RiQuillPenAiLine,
            name: 'Historial y reportes',
            description: 'Consulta historial de reservas y genera reportes para tu administración.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-reflect.svg',
        },
        {
            Icon: RiHardDrive3Line,
            name: 'Evidencias y archivos',
            description: 'Adjunta comprobantes o fotos a las reservas.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-2',
            background: '/bento-storage.svg',
        },
        {
            Icon: RiTimerFlashLine,
            name: 'Herramientas de productividad',
            description:
                'Recordatorios, notificaciones y bloqueos para que las reglas se cumplan sin fricción.',
            href: '#',
            cta: 'Saber más',
            className: 'col-span-3 lg:col-span-1',
            background: '/bento-pomodoro.svg',
        },
    ];

    return (
        <div className="max-w-6xl mx-auto py-32 px-6">
            <div className="space-y-6 mb-12">
                <h2 className="text-3xl font-bold text-center">Mucho más que solo reservas</h2>
                <p className="text-center text-default-500">
                    Kondodesk reúne funciones clave para administrar amenidades y la comunicación en tu condominio, todo en un mismo lugar.
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
