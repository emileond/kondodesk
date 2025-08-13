import IntegrationCard from '../IntegrationCard.jsx';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    useUserIntegration,
    useDeleteIntegration,
} from '../../../hooks/react-query/integrations/useUserIntegrations.js';
import { useUser } from '../../../hooks/react-query/user/useUser.js';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

const CalendlyIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const { data: integration, isLoading, isPending } = useUserIntegration(user?.id, 'calendly');
    const deleteIntegration = useDeleteIntegration(user?.id, 'calendly');
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const status = useMemo(() => {
        if (!integration || integration.status === 'inactive') return 'inactive';
        else return integration.status;
    }, [integration]);

    const { setValue } = useForm();

    const handleConnect = () => {
        const clientId = import.meta.env.VITE_CALENDLY_CLIENT_ID;

        const authUrl = new URL('https://auth.calendly.com/oauth/authorize');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set(
            'redirect_uri',
            'https://weekfuse.com/integrations/oauth/callback/calendly',
        );

        window.location.href = authUrl.toString();
    };

    const handleDisconnect = () => {
        if (!integration) return;
        setLoading(true);
        deleteIntegration.mutate(
            {
                id: integration.id,
                type: 'calendly',
            },
            {
                onSuccess: async () => {
                    toast.success('Calendly disconnected');
                    queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'calendly'],
                    });
                },
                onError: (error) => {
                    console.error('Error disconnecting Calendly:', error);
                    toast.error('Failed to disconnect Calendly');
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
        <IntegrationCard
            id="calendly"
            icon="calendly"
            name="Calendly"
            isLoading={loading}
            isPending={isPending}
            isCompact={isCompact}
            description="Import your Calendly events."
            status={status}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onReset={handleDisconnect}
            hasConfigOptions={false}
        />
    );
};

export default CalendlyIntegrationCard;
