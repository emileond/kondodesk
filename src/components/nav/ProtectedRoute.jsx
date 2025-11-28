import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/react-query/user/useUser';
import { useWorkspaces } from '../../hooks/react-query/condos/useWorkspaces';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';

// A simple loading spinner component
const FullScreenLoader = () => (
    <div className="w-screen h-screen flex justify-center items-center">
        <p>Loading...</p>
    </div>
);

function ProtectedRoute({ children }) {
    const { data: user, isPending: isUserLoading } = useUser();
    // Pass an `enabled` flag to the useWorkspaces hook based on the user's existence
    const { data: workspaces, isPending: isWorkspacesLoading } = useWorkspaces(user, {
        enabled: !!user, // This is a common pattern with libraries like React Query
    });
    const [currentWorkspace, setCurrentWorkspace] = useCurrentWorkspace();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // 1. If the user fetch is done and there's NO user, redirect immediately.
        // This is the highest priority and doesn't depend on workspaces.
        if (!isUserLoading && !user) {
            navigate('/login');
            return;
        }

        // 2. If we have a user but are waiting for their workspaces, do nothing yet.
        if (isWorkspacesLoading) {
            return;
        }

        // At this point, we know 'user' exists and 'workspaces' are loaded.
        if (!user) return; // Safeguard, though the above check should handle it.

        // 3. Set a default workspace if none is set
        if (workspaces && workspaces.length > 0 && !currentWorkspace) {
            const defaultWorkspace = workspaces.find((ws) => ws.role === 'owner') || workspaces[0];
            setCurrentWorkspace(defaultWorkspace);
            return; // Allow re-render
        }

        // 4. Handle users with no workspaces
        if (workspaces && workspaces.length === 0) {
            navigate('/auth');
            return;
        }

        if (!currentWorkspace) return;

        // 5. Onboarding Check
        if (!currentWorkspace.onboarded) {
            if (location.pathname !== '/onboarding') {
                navigate('/onboarding');
            }
            return;
        }

        // 6. Trial Expiration Check

        const { subscription_status } = currentWorkspace;
        if (subscription_status === 'trial ended' || subscription_status === 'cancelled') {
            const isSettings =
                location.pathname === '/settings' || location.pathname.startsWith('/settings/');
            const isPaywall = location.pathname === '/paywall';
            if (!isSettings && !isPaywall) {
                navigate('/paywall');
            }
        }
    }, [
        user,
        isUserLoading,
        workspaces,
        isWorkspacesLoading,
        currentWorkspace,
        setCurrentWorkspace,
        navigate,
        location.pathname,
    ]);

    // Show loader only while fetching the user, or if we have a user but are still fetching their workspaces.
    const isLoading = isUserLoading || (user && isWorkspacesLoading);

    if (isLoading) {
        return <FullScreenLoader />;
    }

    // This logic prevents rendering children if a redirect is imminent
    if (user && currentWorkspace) {
        const { subscription_status } = currentWorkspace;
        if (subscription_status === 'trial ended' || subscription_status === 'cancelled') {
            const isAllowedPath =
                location.pathname.startsWith('/settings') || location.pathname === '/paywall';
            if (!isAllowedPath) {
                return null;
            }
        }

        // If checks pass, render the page
        return children;
    }

    return null;
}

export default ProtectedRoute;
