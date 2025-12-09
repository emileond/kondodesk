import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../../hooks/react-query/user/useUser';
import { supabaseClient } from '../../lib/supabase'; // Adjust path
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Spinner } from '@heroui/react';

function AcceptInvitePage() {
    const { data: user, isLoading: isUserLoading } = useUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const token = searchParams.get('invitation_token');

    useEffect(() => {
        const acceptInvitation = async (invitationToken) => {
            if (!user) return; // Should not happen if logic is correct

            try {
                const { data: workspaceId, error } = await supabaseClient.rpc(
                    'accept_workspace_invitation',
                    { invitation_id: invitationToken },
                );

                if (error) throw error;

                toast.success('Invitation accepted!');
                // Clean up any stored token
                localStorage.removeItem('pendingInvitationToken');
                // Refetch workspaces and navigate
                await queryClient.invalidateQueries({ queryKey: ['workspaces', user.id] });
                navigate(`/home`); // Navigate to a general dashboard
            } catch (error) {
                toast.error(`Failed to accept invitation: ${error.message}`);
                navigate('/home'); // Navigate away even on error
            }
        };

        if (isUserLoading) {
            return; // Wait until we know if the user is logged in or not
        }

        if (!token) {
            navigate('/'); // No token, redirect to home
            return;
        }

        if (user) {
            // SCENARIO A: User is already logged in. Accept immediately.
            acceptInvitation(token);
        } else {
            // SCENARIO B: User is not logged in. Store token and redirect to signup.
            localStorage.setItem('pendingInvitationToken', token);
            navigate('/signup'); // Or '/login'
        }
    }, [user, isUserLoading, token, navigate, queryClient]);

    // This page can just be a simple loading spinner.
    return (
        <div className="w-screen h-screen flex justify-center items-center">
            <Spinner />
            <p>Processing your invitation...</p>
        </div>
    );
}

export default AcceptInvitePage;
