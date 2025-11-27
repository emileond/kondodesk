import { Button, Divider } from '@heroui/react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../Logo';
import { navItems } from './navItems';
import UserMenu from './UserMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import TrialEndsCard from '../marketing/TrialEndsCard.jsx';
import CommandPalette from '../CommandPalette.jsx';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';

function Sidebar() {
    const [currentWorkspace] = useCurrentWorkspace();
    const location = useLocation();

    return (
        <div className="basis-60 grow-0 shrink-0 h-screen bg-content2 px-4 py-6 flex flex-col justify-between border-r border-default-200">
            <nav className="w-full flex flex-col items-start gap-1">
                <div className="m-auto px-4">
                    <Logo size="140px" />
                </div>
                <Divider className="my-5" />
                <WorkspaceSwitcher />
                {navItems.map((route, index) => {
                    const isActive = String(location.pathname).includes(route.path);

                    return (
                        <Button
                            as={Link}
                            key={index}
                            to={route.path}
                            startContent={route?.startContent}
                            className={`text-[14px] xl:text-[15px] h-10 px-4 items-center justify-start w-full ${
                                !isActive && 'text-default-600'
                            } ${isActive && 'bg-content4/60'}`}
                            size="lg"
                            color={isActive ? 'primary' : 'default'}
                            variant={isActive ? 'flat' : 'light'}
                        >
                            {route.name}
                        </Button>
                    );
                })}
            </nav>
            <div className="flex flex-col gap-3">
                {currentWorkspace?.subscription_status === 'trial' && <TrialEndsCard />}
                <Divider />
                <CommandPalette />
                <UserMenu />
            </div>
        </div>
    );
}

export default Sidebar;
