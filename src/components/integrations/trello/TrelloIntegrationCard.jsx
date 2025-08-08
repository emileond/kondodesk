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
    RadioGroup,
    Radio,
    Divider,
} from '@heroui/react';
import useCurrentWorkspace from '../../../hooks/useCurrentWorkspace.js';
import { useQueryClient } from '@tanstack/react-query';
import ProjectSelect from '../../../components/form/ProjectSelect.jsx';

const TrelloIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'trello');
    const deleteIntegration = useDeleteIntegration(user.id, 'trello');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user.id, 'trello');
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
            'https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=22d71bb66c8e12f0668dd083c1118d2a&callback_method=fragment&return_url=https://weekfuse.com/integrations/oauth/callback/trello';
    };

    const handleDisconnect = () => {
        if (!integration) return;

        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                access_token: integration.access_token,
                type: 'trello',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Trello Integration disconnected');
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
                    console.error('Error disconnecting Trello:', error);
                    toast.error('Failed to disconnect Trello Integration');
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
                type: 'trello',
            },
            {
                onSuccess: () => {
                    setStatus('inactive');
                    toast.success('Trello Integration reset');
                },
                onError: (error) => {
                    console.error('Error resetting Trello:', error);
                    toast.error('Failed to reset Trello Integration');
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
                    toast.success('Trello configuration saved');
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Trello configuration:', error);
                    toast.error('Failed to save Trello configuration');
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
                id="trello"
                icon="trello"
                name="Trello"
                isCompact={isCompact}
                isLoading={loading}
                isPending={isPending}
                description="Import all Trello cards from boards visible to you."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleReset}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="trello-config">
                        <ModalHeader>Trello Configuration</ModalHeader>
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
                                                    Automatically update in Trello
                                                </Radio>
                                                <Radio value="prompt">
                                                    Ask before updating in Trello
                                                </Radio>
                                                <Radio value="never">Do nothing in Trello</Radio>
                                            </RadioGroup>
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
                                form="trello-config"
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

export default TrelloIntegrationCard;
