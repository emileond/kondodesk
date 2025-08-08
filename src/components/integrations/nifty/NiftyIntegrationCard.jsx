import IntegrationCard from '../IntegrationCard.jsx';
import { RiTaskLine } from 'react-icons/ri';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '../../../hooks/react-query/user/useUser.js';
import {
    useUserIntegration,
    useDeleteIntegration,
    useUpdateIntegrationConfig,
} from '../../../hooks/react-query/integrations/useUserIntegrations.js';
import { useForm, Controller } from 'react-hook-form';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    RadioGroup,
    Radio,
    Divider,
} from '@heroui/react';
import useCurrentWorkspace from '../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../components/form/ProjectSelect.jsx';

const NiftyIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'nifty');
    const deleteIntegration = useDeleteIntegration(user.id, 'nifty');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'nifty');
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

    const clientId = import.meta.env.VITE_NIFTY_CLIENT_ID;

    const handleConnect = () => {
        window.location.href = `https://nifty.pm/authorize?response_type=code&client_id=${clientId}&redirect_uri=https://weekfuse.com/integrations/oauth/callback/nifty&scope=task,,subtask,label,milestone,member,project,task_group`;
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'nifty',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Nifty Integration disconnected');
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
                    console.error('Error disconnecting Nifty:', error);
                    toast.error('Failed to disconnect Nifty Integration');
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
                type: 'nifty',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Nifty Integration disconnected');
                },
                onError: (error) => {
                    console.error('Error disconnecting Nifty:', error);
                    toast.error('Failed to disconnect Nifty Integration');
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
                    toast.success('Nifty configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Nifty configuration:', error);
                    toast.error('Failed to save Nifty configuration');
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
                id="nifty"
                icon="nifty"
                name="Nifty"
                isCompact={isCompact}
                isLoading={loading}
                isPending={isPending}
                description="Import Nifty tasks assigned to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleReset}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="nifty-config">
                        <ModalHeader>Nifty Configuration</ModalHeader>
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
                                                    Automatically update in Nifty
                                                </Radio>
                                                <Radio value="prompt">
                                                    Ask before updating in Nifty
                                                </Radio>
                                                <Radio value="never">Do nothing in Nifty</Radio>
                                            </RadioGroup>
                                        )}
                                    />
                                </div>
                                <Divider />
                                <div className="space-y-3">
                                    <span className="font-semibold">Assign to project</span>
                                    <p className="text-default-600 text-sm">
                                        Choose a project for all tasks imported from Nifty
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
                                form="nifty-config"
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

export default NiftyIntegrationCard;
