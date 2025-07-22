import IntegrationCard from '../../IntegrationCard.jsx';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
    useUserIntegration,
    useDeleteIntegration,
    useUpdateIntegrationConfig,
} from '../../../../hooks/react-query/integrations/useUserIntegrations.js';
import { useUser } from '../../../../hooks/react-query/user/useUser.js';
import { useForm, Controller } from 'react-hook-form';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    Divider,
} from '@heroui/react';
import useCurrentWorkspace from '../../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../../components/form/ProjectSelect.jsx';

const GoogleTasksIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const {
        data: integration,
        isLoading,
        isPending,
    } = useUserIntegration(user?.id, 'google_tasks');
    const deleteIntegration = useDeleteIntegration(user.id, 'google_tasks');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'google_tasks');
    const [status, setStatus] = useState('inactive');
    const [loading, setLoading] = useState(false);
    const [currentWorkspace] = useCurrentWorkspace();
    const queryClient = useQueryClient();

    // Configuration modal state
    const { isOpen, onOpen, onClose } = useDisclosure();

    // Form setup with react-hook-form
    const {
        handleSubmit,
        setValue,
        control,
        formState: { errors },
    } = useForm();

    const handleConnect = () => {
        // Generate a random state for CSRF protection
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('google_tasks_oauth_state', state);

        const params = new URLSearchParams({
            client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
            redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/google_tasks',
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/tasks',
            access_type: 'offline',
            prompt: 'consent',
            state: state,
        });

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                installation_id: integration.installation_id,
                type: 'google_tasks',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Google Tasks Integration disconnected');
                    // Invalidate all task-related queries for the workspace
                    queryClient.invalidateQueries({
                        queryKey: ['tasks', currentWorkspace?.workspace_id],
                        refetchType: 'all',
                    });
                    queryClient.invalidateQueries({
                        queryKey: ['backlogTasks', currentWorkspace?.workspace_id],
                        refetchType: 'all',
                    });
                    queryClient.invalidateQueries({
                        queryKey: ['fuzzySearchTasks', currentWorkspace?.workspace_id],
                        refetchType: 'all',
                    });
                },
                onError: (error) => {
                    console.error('Error disconnecting Google Tasks:', error);
                    toast.error('Failed to disconnect Google Tasks Integration');
                },
                onSettled: () => {
                    setLoading(false);
                },
            },
        );
    };

    const handleConfigure = () => {
        // Set default values from existing config when opening the modal
        if (integration && integration.config) {
            if (integration.config.project_id) {
                setValue('project_id', integration.config.project_id);
            }
        }
        onOpen();
    };

    const onSubmit = (data) => {
        console.log(data);
        if (!integration) return;

        setLoading(true);
        // Use form data for the config
        const config = {
            project_id: data.project_id,
        };

        updateIntegrationConfig.mutate(
            {
                id: integration.id,
                config,
            },
            {
                onSuccess: () => {
                    toast.success('Google Tasks configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Google Tasks configuration:', error);
                    toast.error('Failed to save Google Tasks configuration');
                },
                onSettled: () => {
                    setLoading(false);
                },
            },
        );
    };

    useEffect(() => {
        setLoading(isLoading);
        if (integration) {
            setStatus(integration.status);

            // Set form values if integration config exists
            if (integration.config && integration.config.project_id) {
                setValue('project_id', integration.config.project_id);
            }
        }
    }, [integration, isLoading, setValue]);

    return (
        <>
            <IntegrationCard
                id="google_tasks"
                name="Google Tasks"
                isLoading={loading}
                isPending={isPending}
                isCompact={isCompact}
                description="Import tasks from your Google Tasks lists."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleDisconnect}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="google-tasks-config">
                        <ModalHeader>Google Tasks Configuration</ModalHeader>
                        <ModalBody>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a Weekfuse project for all tasks imported from Google
                                        Tasks
                                    </p>
                                    <Controller
                                        name="project_id"
                                        control={control}
                                        render={({ field }) => (
                                            <ProjectSelect
                                                defaultValue={field.value}
                                                onChange={(option) => {
                                                    field.onChange(option ? option.value : null);
                                                }}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                type="submit"
                                form="google-tasks-config"
                                isLoading={loading}
                            >
                                Save
                            </Button>
                        </ModalFooter>
                    </form>
                </ModalContent>
            </Modal>
        </>
    );
};

export default GoogleTasksIntegrationCard;
