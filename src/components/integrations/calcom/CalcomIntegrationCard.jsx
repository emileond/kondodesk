import IntegrationCard from '../IntegrationCard.jsx';
import { useState, useEffect, useMemo } from 'react';
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
} from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';

const CalcomIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'calcom');
    const deleteIntegration = useDeleteIntegration(user?.id, 'calcom');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user?.id, 'calcom');
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const { isOpen, onOpen, onClose } = useDisclosure();

    const status = useMemo(() => {
        if (!integration || integration.status === 'inactive') return 'inactive';
        else return integration.status;
    }, [integration]);

    const { handleSubmit, setValue, control } = useForm();

    const handleConnect = () => {};

    const handleDisconnect = () => {
        if (!integration) return;
        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'calcom',
            },
            {
                onSuccess: async () => {
                    toast.success('Cal.com disconnected');
                    queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'calcom'],
                    });
                },
                onError: (error) => {
                    console.error('Error disconnecting Cal.com:', error);
                    toast.error('Failed to disconnect Cal.com');
                },
                onSettled: () => setLoading(false),
            },
        );
    };

    const handleConfigure = () => {
        if (integration && integration.config) {
            if (integration.config.syncStatus) {
                setValue('syncStatus', integration.config.syncStatus);
            }
        } else {
            setValue('syncStatus', 'auto');
        }
        onOpen();
    };

    const onSubmit = (data) => {
        if (!integration) return;
        setLoading(true);
        const config = { syncStatus: data.syncStatus };

        updateIntegrationConfig.mutate(
            { id: integration.id, config },
            {
                onSuccess: async () => {
                    toast.success('Cal.com configuration saved');
                    await queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'calcom'],
                    });
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Cal.com configuration:', error);
                    toast.error('Failed to save Cal.com configuration');
                },
                onSettled: () => setLoading(false),
            },
        );
    };

    useEffect(() => {
        setLoading(isLoading);
        if (integration) {
            if (integration.config && integration.config.syncStatus) {
                setValue('syncStatus', integration.config.syncStatus);
            }
        }
    }, [integration, isLoading, setValue]);

    return (
        <>
            <IntegrationCard
                id="calcom"
                icon="calcom"
                name="Cal.com"
                isLoading={loading}
                isPending={isPending}
                isCompact={isCompact}
                description="Import your bookings from Cal.com"
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleDisconnect}
                onConfigure={handleConfigure}
                hasConfigOptions={false}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="ms-calendar-config">
                        <ModalHeader>Cal.com configuration</ModalHeader>
                        <ModalBody>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <span className="font-semibold">Sync event changes</span>
                                    <p className="text-default-600 text-sm">
                                        How should Weekfuse update event changes back to Cal.com?
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
                                                    Automatically update in Cal.com
                                                </Radio>
                                                <Radio value="prompt">
                                                    Ask before updating in Cal.com
                                                </Radio>
                                                <Radio value="never">Do nothing in Cal.com</Radio>
                                            </RadioGroup>
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
                                form="ms-calendar-config"
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

export default CalcomIntegrationCard;
