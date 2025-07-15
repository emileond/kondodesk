import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import ky from 'ky';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import toast from 'react-hot-toast';
import { Spinner } from '@heroui/react';
import AppLayout from '../../components/layout/AppLayout.jsx';
import { useQueryClient } from '@tanstack/react-query';

const OAuthCallback = () => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const { provider } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();
    const { hash } = useLocation();

    const handleNavigate = () => {
        if (currentWorkspace?.onboarded) {
            navigate('/integrations');
        } else {
            navigate('/onboarding');
        }
    };

    const handleGithubCallback = async ({ code, installation_id }) => {
        setLoading(true);
        try {
            await ky.post('/api/github/auth', {
                json: {
                    code,
                    installation_id,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('GitHub Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'github'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'github'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect GitHub Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to GitHub:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleJiraCallback = async ({ code }) => {
        setLoading(true);
        try {
            await ky.post('/api/jira/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('Jira Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'jira'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'jira'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect Jira Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to Jira:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleTrelloCallback = async ({ token }) => {
        setLoading(true);
        try {
            await ky.post('/api/trello/auth', {
                json: {
                    access_token: token,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('Trello Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'trello'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'trello'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect Trello';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to Trello:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleClickupCallback = async ({ code }) => {
        setLoading(true);
        try {
            await ky.post('/api/clickup/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('ClickUp Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'clickup'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'clickup'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect ClickUp Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to ClickUp:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleMondayCallback = async ({ code }) => {
        setLoading(true);
        try {
            await ky.post('/api/monday/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('Monday.com Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'monday'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'monday'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect Monday.com Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to Monday.com:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleTickTickCallback = async ({ code }) => {
        setLoading(true);
        try {
            await ky.post('/api/ticktick/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('TickTick Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'ticktick'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'ticktick'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect TickTick Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to TickTick:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleTodoistCallback = async ({ code }) => {
        setLoading(true);
        try {
            // Verify state parameter to prevent CSRF attacks
            const state = searchParams.get('state');
            const storedState = localStorage.getItem('todoist_oauth_state');

            if (state !== storedState) {
                throw new Error('State verification failed');
            }

            // Clear the stored state
            localStorage.removeItem('todoist_oauth_state');

            await ky.post('/api/todoist/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                },
            });

            toast.success('Todoist Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'todoist'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'todoist'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect Todoist Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to Todoist:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    const handleAsanaCallback = async ({ code }) => {
        setLoading(true);
        try {
            // Verify state parameter to prevent CSRF attacks
            const state = searchParams.get('state');
            const storedState = localStorage.getItem('asana_oauth_state');

            if (state !== storedState) {
                throw new Error('State verification failed');
            }

            // Clear the stored state
            localStorage.removeItem('asana_oauth_state');

            await ky.post('/api/asana/auth', {
                json: {
                    code,
                    user_id: user.id,
                    workspace_id: currentWorkspace.workspace_id,
                    state,
                },
            });

            toast.success('Asana Integration connected');
            await queryClient.cancelQueries({
                queryKey: ['user_integration', user?.id, 'asana'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['user_integration', user?.id, 'asana'],
            });
        } catch (error) {
            let errorMessage = 'Failed to connect Asana Integration';
            if (error.response) {
                const errorData = await error.response.json();
                errorMessage = errorData.message || errorMessage;
            }
            console.error('Error connecting to Asana:', error);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            handleNavigate();
        }
    };

    useEffect(() => {
        if (!user || !currentWorkspace) return;

        const code = searchParams.get('code');

        switch (provider) {
            case 'github': {
                const installation_id = searchParams.get('installation_id');
                handleGithubCallback({ code, installation_id });

                break;
            }
            case 'jira':
                handleJiraCallback({ code });
                break;
            case 'trello':
                {
                    const params = new URLSearchParams(hash.slice(1));
                    const token = params.get('token');
                    handleTrelloCallback({ token });
                }
                break;
            case 'clickup':
                handleClickupCallback({ code });
                break;
            case 'monday':
                handleMondayCallback({ code });
                break;
            case 'ticktick':
                handleTickTickCallback({ code });
                break;
            case 'todoist':
                handleTodoistCallback({ code });
                break;
            case 'asana':
                handleAsanaCallback({ code });
                break;
            default:
                toast.error('Unsupported OAuth provider');
        }
    }, [provider, user, currentWorkspace]);

    if (loading)
        return (
            <AppLayout>
                <div className="fixed top-0 w-full h-full flex justify-center items-center bg-content3">
                    <Spinner size="lg" label="Working on it..." />
                </div>
            </AppLayout>
        );
};

export default OAuthCallback;
