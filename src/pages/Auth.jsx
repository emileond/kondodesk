import { useEffect, useState, useRef } from 'react'; // 👈 1. Import useRef
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { useUser } from '../hooks/react-query/user/useUser.js';
import { useWorkspaces } from '../hooks/react-query/condos/useWorkspaces.js';
import { supabaseClient } from '../lib/supabase.js';
import AuthForm from '../components/auth/AuthForm';
import { Spinner } from '@heroui/react';

function AuthPage({ viewMode }) {
    const { data: user } = useUser();

    const { data: workspaces, isPending: isWorkspacesLoading } = useWorkspaces(user, {
        enabled: !!user,
    });

    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [statusMessage, setStatusMessage] = useState('Initializing...');

    // 2. Use a ref for the lock. It will not trigger re-renders.
    const isProcessing = useRef(false);

    useEffect(() => {
        // 3. The guard now checks the ref's .current property.
        if (!user || isWorkspacesLoading || isProcessing.current) {
            return;
        }

        const processUser = async () => {
            // 4. Set the lock. This does NOT cause a re-render.
            isProcessing.current = true;

            const invitationToken = searchParams.get('invitation_token');

            if (invitationToken) {
                setStatusMessage('Accepting your invitation...');
                try {
                    await supabaseClient.rpc('accept_workspace_invitation', {
                        invitation_id: invitationToken,
                    });
                    toast.success('Welcome aboard! You have joined the workspace.');
                    searchParams.delete('invitation_token');
                    setSearchParams(searchParams, { replace: true });
                    await queryClient.refetchQueries({ queryKey: ['workspaces'] });
                    navigate('/dashboard');
                } catch (error) {
                    toast.error(`Failed to accept invitation: ${error.message}`);
                    isProcessing.current = false; // Unlock on error
                    navigate('/');
                }
                return;
            }

            if (workspaces && workspaces.length > 0) {
                navigate('/dashboard');
                return;
            }

            if (workspaces && workspaces.length === 0) {
                setStatusMessage('Creating your new workspace...');
                try {
                    // await supabaseClient.rpc('create_new_workspace_and_start_trial');
                    // toast.success('Your new workspace is ready!');
                    await queryClient.refetchQueries({ queryKey: ['workspaces'] });
                    navigate('/home');
                } catch (error) {
                    toast.error(`Failed to create workspace: ${error.message}`);
                    isProcessing.current = false; // Unlock on error to allow retry
                    navigate('/');
                }
            }
        };

        if (workspaces) {
            processUser();
        }
    }, [
        // 5. REMOVE isProcessing from the dependency array.
        user,
        workspaces,
        isWorkspacesLoading,
        navigate,
        queryClient,
        searchParams,
        setSearchParams,
    ]);

    if (!user) {
        return (
            <div className="w-screen h-screen flex justify-center items-center">
                <AuthForm viewMode={viewMode} />
            </div>
        );
    }

    return (
        <div className="w-screen h-screen flex justify-center items-center">
            <Spinner />
            <p className="ml-4">{statusMessage}</p>
        </div>
    );
}

export default AuthPage;
