import IntegrationCard from '../../IntegrationCard.jsx';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    useUserIntegration,
    useDeleteIntegration,
} from '../../../../hooks/react-query/integrations/useUserIntegrations.js';
import { useUser } from '../../../../hooks/react-query/user/useUser.js';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

const GoogleCalendarIntegrationCard = ({ isCompact }) => {
    const { data: user } = useUser();
    const {
        data: integration,
        isLoading,
        isPending,
    } = useUserIntegration(user?.id, 'google_calendar');
    const deleteIntegration = useDeleteIntegration(user?.id, 'google_calendar');
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const status = useMemo(() => {
        if (!integration || integration.status === 'inactive') return 'inactive';
        else return integration.status;
    }, [integration]);

    const { setValue } = useForm();

    const handleConnect = () => {
        // Generate a random state for CSRF protection
        const state = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('google_cal_oauth_state', state);

        const params = new URLSearchParams({
            client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
            redirect_uri: 'https://weekfuse.com/integrations/oauth/callback/google_calendar',
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/calendar.events',
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
                type: 'google_calendar',
            },
            {
                onSuccess: async () => {
                    toast.success('Calendly disconnected');
                    queryClient.invalidateQueries({
                        queryKey: ['user_integration', user?.id, 'google_calendar'],
                    });
                },
                onError: (error) => {
                    console.error('Error disconnecting Google Calendar:', error);
                    toast.error('Failed to disconnect Google Calendar');
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
            id="google_calendar"
            icon="google_calendar"
            name="Google Calendar"
            isLoading={loading}
            isPending={isPending}
            isCompact={isCompact}
            description="Import your Google Calendar events."
            status={status}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onReset={handleDisconnect}
            hasConfigOptions={false}
        />
    );
};

export default GoogleCalendarIntegrationCard;
