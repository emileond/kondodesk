import { useEffect } from 'react';
import { useUser } from '../hooks/react-query/user/useUser';
import { useUserProfile } from '../hooks/react-query/user/useUserProfile.js';
import { useWorkspaces } from '../hooks/react-query/condos/useWorkspaces';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import OnboardingSteps from '../components/onboarding/OnboardingSteps';
import Logo from '../components/Logo.jsx';

function OnboardingPage() {
    const { data: user } = useUser();
    const { data: workspaces } = useWorkspaces(user);
    const { data: userProfile } = useUserProfile(user);
    const [currentWorkspace, setCurrentWorkspace] = useCurrentWorkspace();

    useEffect(() => {
        // If currentWorkspace is not set but workspaces exist, find the one where user is owner
        if (!currentWorkspace && workspaces && workspaces.length > 0) {
            const ownerWorkspace = workspaces.find((workspace) => workspace.role === 'owner');
            if (ownerWorkspace) {
                setCurrentWorkspace(ownerWorkspace);
            }
        }
    }, [workspaces, currentWorkspace, setCurrentWorkspace]);

    return (
        <div className="w-screen h-screen bg-content1 flex justify-center items-center bg-linear-to-b from-content1 to-primary-50">
            <div className="p-9">
                <div className="flex justify-center mb-10">
                    <Logo />
                </div>
                <OnboardingSteps
                    userProfile={userProfile}
                    currentWorkspace={currentWorkspace}
                    setCurrentWorkspace={setCurrentWorkspace}
                />
            </div>
        </div>
    );
}

export default OnboardingPage;
