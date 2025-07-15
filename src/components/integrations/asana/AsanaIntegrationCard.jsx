import IntegrationCard from '../IntegrationCard.jsx';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
    useUserIntegration,
    useDeleteIntegration,
    useUpdateIntegrationConfig,
} from '../../../hooks/react-query/integrations/useUserIntegrations.js';
import { useUser } from '../../../hooks/react-query/user/useUser.js';
import { useForm, Controller } from 'react-hook-form';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    Switch,
    Divider,
} from '@heroui/react';
import useCurrentWorkspace from '../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../components/form/ProjectSelect.jsx';

const AsanaIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'asana');
    const deleteIntegration = useDeleteIntegration(user.id, 'asana');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'asana');
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
        // Generate a random state parameter for CSRF protection
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('asana_oauth_state', state);

        // Asana OAuth URL - will need to be configured with actual client_id
        const clientId = import.meta.env.VITE_ASANA_CLIENT_ID;
        const redirectUri = encodeURIComponent(
            'https://weekfuse.com/integrations/oauth/callback/asana',
        );
        const scope = encodeURIComponent(
            'attachments:read projects:read stories:read tasks:read tasks:write tasks:delete teams:read users:read webhooks:read webhooks:write workspaces:read ',
        );

        window.location.href = `https://app.asana.com/-/oauth_authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=${scope}`;
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                installation_id: integration.installation_id,
                type: 'asana',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Asana Integration disconnected');
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
                    console.error('Error disconnecting Asana:', error);
                    toast.error('Failed to disconnect Asana Integration');
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
            if (integration.config.syncStatus) {
                setValue('syncStatus', integration.config.syncStatus === 'prompt');
            }
            if (integration.config.project_id) {
                setValue('project_id', integration.config.project_id);
            }
        } else {
            // Default to false (never) if no config exists
            setValue('syncStatus', false);
        }
        onOpen();
    };

    const onSubmit = (data) => {
        console.log(data);
        if (!integration) return;

        setLoading(true);
        // Use form data for the config
        const config = {
            syncStatus: data.syncStatus ? 'prompt' : 'never',
            project_id: data.project_id,
        };

        updateIntegrationConfig.mutate(
            {
                id: integration.id,
                config,
            },
            {
                onSuccess: () => {
                    toast.success('Asana configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Asana configuration:', error);
                    toast.error('Failed to save Asana configuration');
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
            if (integration.config && integration.config.syncStatus) {
                setValue('syncStatus', integration.config.syncStatus === 'prompt');
            }
        }
    }, [integration, isLoading, setValue]);

    return (
        <>
            <IntegrationCard
                id="asana"
                name="Asana"
                isLoading={loading}
                isPending={isPending}
                isCompact={isCompact}
                description="Import Asana tasks assigned to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleDisconnect}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="asana-config">
                        <ModalHeader>Asana Configuration</ModalHeader>
                        <ModalBody>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <span className="font-semibold">Sync task status</span>
                                    <p className="text-default-600 text-sm">
                                        What should happen when you change the status of an imported
                                        task?
                                    </p>
                                    <Controller
                                        name="syncStatus"
                                        control={control}
                                        render={({ field }) => (
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    isSelected={field.value}
                                                    onValueChange={field.onChange}
                                                />
                                                <span>Ask to update in Asana</span>
                                            </div>
                                        )}
                                    />
                                </div>
                                <Divider />
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a project for all tasks imported from Asana
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
                                form="asana-config"
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

export default AsanaIntegrationCard;
