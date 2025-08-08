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
    Switch,
    Divider,
} from '@heroui/react';
import useCurrentWorkspace from '../../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../../components/form/ProjectSelect.jsx';

const ZohoProjectsIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const {
        data: integration,
        isLoading,
        isPending,
    } = useUserIntegration(user?.id, 'zoho_projects');
    const deleteIntegration = useDeleteIntegration(user.id, 'zoho_projects');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'zoho_projects');
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
        const clientId = import.meta.env.VITE_ZOHO_PROJECTS_CLIENT_ID;
        // Zoho Projects OAuth URL - will need to be configured with actual client ID
        window.location.href = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoProjects.portals.READ,ZohoProjects.tasks.ALL,ZohoProjects.projects.READ,ZohoProjects.users.READ&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=https%3A%2F%2Fweekfuse.com%2Fintegrations%2Foauth%2Fcallback%2Fzoho_projects&prompt=consent`;
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                installation_id: integration.installation_id,
                type: 'zoho_projects',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Zoho Projects Integration disconnected');
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
                    console.error('Error disconnecting Zoho Projects:', error);
                    toast.error('Failed to disconnect Zoho Projects Integration');
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
                    toast.success('Zoho Projects configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Zoho Projects configuration:', error);
                    toast.error('Failed to save Zoho Projects configuration');
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
                id="zoho_projects"
                icon="zoho_projects"
                name="Zoho Projects"
                isLoading={loading}
                isPending={isPending}
                isCompact={isCompact}
                description="Import Zoho Projects tasks assigned to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleDisconnect}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="zoho-projects-config">
                        <ModalHeader>Zoho Projects Configuration</ModalHeader>
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
                                                <span>Ask to update in Zoho Projects</span>
                                            </div>
                                        )}
                                    />
                                </div>
                                <Divider />
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a project for all tasks imported from Zoho Projects
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
                                form="zoho-projects-config"
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

export default ZohoProjectsIntegrationCard;
