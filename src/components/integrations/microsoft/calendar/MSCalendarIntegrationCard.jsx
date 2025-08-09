import IntegrationCard from '../../IntegrationCard.jsx';
import { useState, useEffect, useMemo } from 'react';
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
    RadioGroup,
    Radio,
} from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';

const MSCalendarIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const {
        data: integration,
        isLoading,
        isPending,
    } = useUserIntegration(user?.id, 'microsoft_calendar');
    const deleteIntegration = useDeleteIntegration(user?.id, 'microsoft_calendar');
    const updateIntegrationConfig = useUpdateIntegrationConfig(user?.id, 'microsoft_calendar');
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const { isOpen, onOpen, onClose } = useDisclosure();

    const status = useMemo(() => {
        if (!integration || integration.status === 'inactive') return 'inactive';
        else return integration.status;
    }, [integration]);

    const { handleSubmit, setValue, control } = useForm();

    const handleConnect = () => {
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('microsoft_calendar_oauth_state', state);

        const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;

        const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set(
            'redirect_uri',
            'https://weekfuse.com/integrations/oauth/callback/microsoft_calendar',
        );
        authUrl.searchParams.set(
            'scope',
            'Calendars.ReadWrite Calendars.ReadWrite.Shared User.Read offline_access',
        );
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('response_mode', 'query');

        window.location.href = authUrl.toString();
    };

    const handleDisconnect = () => {
        if (!integration) return;
        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'microsoft',
                serviceToDisconnect: 'calendar',
            },
            {
                onSuccess: async () => {
                    toast.success('Microsoft Calendar Integration disconnected');
                    queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'microsoft_calendar'],
                    });
                },
                onError: (error) => {
                    console.error('Error disconnecting Microsoft Calendar:', error);
                    toast.error('Failed to disconnect Microsoft Calendar Integration');
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
                    toast.success('Microsoft Calendar configuration saved');
                    await queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'microsoft_calendar'],
                    });
                    onClose();
                },
                onError: (error) => {
                    console.error('Error saving Microsoft Calendar configuration:', error);
                    toast.error('Failed to save Microsoft Calendar configuration');
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
                id="microsoft_calendar"
                icon="microsoft_calendar"
                name="Microsoft Calendar"
                isLoading={loading}
                isPending={isPending}
                isCompact={isCompact}
                description="Import your events from Microsoft Calendar."
                status={status}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onReset={handleDisconnect}
                onConfigure={handleConfigure}
                hasConfigOptions={true}
            />

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <form onSubmit={handleSubmit(onSubmit)} id="ms-calendar-config">
                        <ModalHeader>Microsoft Calendar Configuration</ModalHeader>
                        <ModalBody>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <span className="font-semibold">Sync event changes</span>
                                    <p className="text-default-600 text-sm">
                                        How should Weekfuse update event changes back to Microsoft
                                        Calendar?
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
                                                    Automatically update in Microsoft Calendar
                                                </Radio>
                                                <Radio value="prompt">
                                                    Ask before updating in Microsoft Calendar
                                                </Radio>
                                                <Radio value="never">
                                                    Do nothing in Microsoft Calendar
                                                </Radio>
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

export default MSCalendarIntegrationCard;
