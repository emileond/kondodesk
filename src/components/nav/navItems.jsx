import {
    RiCalendarEventLine,
    RiGroupLine,
    RiSettingsLine,
    RiHome2Line,
    RiStarLine,
    RiMegaphoneLine,
    RiFolder2Line,
} from 'react-icons/ri';

const ICON_SIZE = '1.2rem';

export const navItems = [
    {
        name: 'Inicio',
        path: '/home',
        startContent: <RiHome2Line fontSize={ICON_SIZE} />,
        endContent: null,
    },
    {
        name: 'Reservas',
        path: '/reservas',
        startContent: <RiCalendarEventLine fontSize={ICON_SIZE} />,
        endContent: null,
    },
    {
        name: 'Amenidades',
        path: '/amenidades',
        startContent: <RiStarLine fontSize={ICON_SIZE} />,
        endContent: null,
    },
    {
        name: 'Avisos',
        path: '/notes',
        startContent: <RiMegaphoneLine fontSize={ICON_SIZE} />,
        endContent: null,
    },
    {
        name: 'Archivos',
        path: '/archivos',
        startContent: <RiFolder2Line fontSize={ICON_SIZE} />,
        endContent: null,
    },
    {
        name: 'Usuarios',
        path: '/team',
        startContent: <RiGroupLine fontSize={ICON_SIZE} />,
        endContent: null,
    },
    // {
    //     name: 'Integrations',
    //     path: '/integrations',
    //     startContent: <RiRefreshLine fontSize={ICON_SIZE} />,
    //     endContent: null,
    // },
    {
        name: 'Configuracion',
        path: '/settings',
        startContent: <RiSettingsLine fontSize={ICON_SIZE} />,
        endContent: null,
    },
];
