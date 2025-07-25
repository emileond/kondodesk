import { useState, useEffect } from 'react';
import Sidebar from '../nav/Sidebar';
import Appbar from '../nav/Appbar';
import TakuWidget from '../marketing/TakuWidget.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import { useTaskSubscriptions } from '../../hooks/subscriptions/useTasksSubscriptions.js';

function AppLayout({ children }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const [showSidebar, setShowSidebar] = useState(true);

    useTaskSubscriptions(currentWorkspace?.workspace_id);

    // Check screen size and set showSidebar
    useEffect(() => {
        const handleResize = () => {
            setShowSidebar(window.innerWidth >= 639); // md breakpoint is typically 768px
        };

        handleResize(); // Set initial value
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className={`flex ${!showSidebar ? 'flex-col' : ''} h-screen w-screen bg-background overflow-hidden`}
        >
            <TakuWidget />
            {showSidebar && <Sidebar />}
            {!showSidebar && <Appbar />}
            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}

export default AppLayout;
