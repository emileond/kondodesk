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
import { useQueryClient } from '@tanstack/react-query';
import useCurrentWorkspace from '../../../hooks/useCurrentWorkspace.js';
import ProjectSelect from '../../../components/form/ProjectSelect.jsx';

const ClickupIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'clickup');
    const deleteIntegration = useDeleteIntegration(user.id, 'clickup');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'clickup');
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
        window.location.href =
            'https://app.clickup.com/api?client_id=MZHWY0X3R4B24M2XKEV344LUGJZLRVBH&redirect_uri=https://weekfuse.com/integrations/oauth/callback/clickup';
    };

    const handleDisconnect = async () => {
        if (!integration) return;

        setLoading(true);
        await deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'clickup',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Clickup Integration disconnected');
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
                    console.error('Error disconnecting Clickup:', error);
                    toast.error('Failed to disconnect Clickup Integration');
                },
                onSettled: () => {
                    setLoading(false);
                },
            },
        );
    };

    const handleReset = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                access_token: integration.access_token,
                type: 'clickup',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Clickup Integration reset');
                },
                onError: (error) => {
                    console.error('Error resetting Clickup:', error);
                    toast.error('Failed to reset Clickup Integration');
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
                    toast.success('Clickup configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Clickup configuration:', error);
                    toast.error('Failed to save Clickup configuration');
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
                id="clickup"
                icon="clickup"
                name="Clickup"
                isCompact={isCompact}
                isLoading={loading}
                isPending={isPending}
                description="Import all Clickup tasks assigned to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleReset}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="clickup-config">
                        <ModalHeader>Clickup Configuration</ModalHeader>
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
                                                <span>Ask to update in ClickUp</span>
                                            </div>
                                        )}
                                    />
                                </div>
                                <Divider />
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a project for all tasks imported from Jira
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
                                form="clickup-config"
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

export default ClickupIntegrationCard;
