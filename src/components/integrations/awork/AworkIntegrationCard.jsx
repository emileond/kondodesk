import IntegrationCard from '../IntegrationCard.jsx';
import { RiBuilding2Line } from 'react-icons/ri';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '../../../hooks/react-query/user/useUser.js';
import {
    useDeleteIntegration,
    useUpdateIntegrationConfig,
    useUserIntegration,
} from '../../../hooks/react-query/integrations/useUserIntegrations.js';
import { Controller, useForm } from 'react-hook-form';
import {
    Button,
    Divider,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Radio,
    RadioGroup,
    useDisclosure,
} from '@heroui/react';
import useCurrentWorkspace from '../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../components/form/ProjectSelect.jsx';

const AworkIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'awork');
    const deleteIntegration = useDeleteIntegration(user.id, 'awork');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'awork');
    const [status, setStatus] = useState('inactive');
    const [loading, setLoading] = useState(false);
    const [currentWorkspace] = useCurrentWorkspace();
    const queryClient = useQueryClient();

    // Configuration modal state
    const { isOpen, onOpen, onClose } = useDisclosure();

    // Form setup with react-hook-form
    const { handleSubmit, setValue, control } = useForm();

    const handleConnect = () => {
        // Generate OAuth URL for Awork
        const clientId = import.meta.env.VITE_AWORK_CLIENT_ID;
        const redirectUri = 'https://weekfuse.com/integrations/oauth/callback/awork';
        const state = btoa(
            JSON.stringify({ user_id: user?.id, workspace_id: currentWorkspace?.workspace_id }),
        );

        window.location.href = `https://api.awork.com/api/v1/accounts/authorize?client_id=${clientId}&response_type=code&grant_type=authorization_code&redirect_uri=${redirectUri}&scope=offline_access`;
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'awork',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Awork Integration disconnected');
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
                    console.error('Error disconnecting Awork:', error);
                    toast.error('Failed to disconnect Awork Integration');
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
                type: 'awork',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Awork Integration disconnected');
                },
                onError: (error) => {
                    console.error('Error disconnecting Awork:', error);
                    toast.error('Failed to disconnect Awork Integration');
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
                setValue('syncStatus', integration.config.syncStatus);
            }
            if (integration.config.project_id) {
                setValue('project_id', integration.config.project_id);
            }
        } else {
            // Default to 'auto' if no config exists
            setValue('syncStatus', 'auto');
        }
        onOpen();
    };

    const onSubmit = (data) => {
        if (!integration) return;

        setLoading(true);
        // Use form data for the config
        const config = {
            syncStatus: data.syncStatus,
            project_id: data.project_id,
        };

        updateIntegrationConfig.mutate(
            {
                id: integration.id,
                config,
            },
            {
                onSuccess: () => {
                    toast.success('Awork configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Awork configuration:', error);
                    toast.error('Failed to save Awork configuration');
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
        }
    }, [integration, isLoading, setValue]);

    return (
        <>
            <IntegrationCard
                id="awork"
                name="Awork"
                isCompact={isCompact}
                isLoading={loading}
                isPending={isPending}
                icon={<RiBuilding2Line />}
                description="Import Awork tasks assigned to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleReset}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="awork-config">
                        <ModalHeader>Awork Configuration</ModalHeader>
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
                                            <RadioGroup
                                                size="sm"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <Radio value="auto">
                                                    Automatically update in Awork
                                                </Radio>
                                                <Radio value="prompt">
                                                    Ask before updating in Awork
                                                </Radio>
                                                <Radio value="never">Do nothing in Awork</Radio>
                                            </RadioGroup>
                                        )}
                                    />
                                </div>
                                <Divider />
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a project for all tasks imported from Awork
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
                                form="awork-config"
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

export default AworkIntegrationCard;
