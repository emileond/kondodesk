import Paywall from '../../components/marketing/Paywall.jsx';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../components/layout/PageLayout.jsx';
import AppLayout from '../../components/layout/AppLayout.jsx';

function PaywallPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const navigate = useNavigate();

    useEffect(() => {
        if (currentWorkspace?.subscription_status !== 'trial ended') {
            navigate('/dashboard');
        }
    }, [currentWorkspace, navigate]);

    const handleOpenChange = () => {
        // Do nothing. This effectively prevents the user from closing the modal.
    };

    return (
        <AppLayout>
            <PageLayout>
                <Paywall
                    isPersistent={true}
                    onOpenChange={handleOpenChange}
                    title="Your trial has ended"
                    feature="unlimited access"
                    volumePricing={false}
                />
            </PageLayout>
        </AppLayout>
    );
}

export default PaywallPage;
