import { Card, CardBody, CardHeader } from '@heroui/react';
import { useState } from 'react';
import Paywall from '../marketing/Paywall.jsx';
import SubscriptionInfo from '../billing/SubscriptionInfo.jsx';

function SettingsBillingTab() {
    const [isPaywallOpen, setIsPaywallOpen] = useState(false);

    return (
        <div className="flex flex-col gap-6 mb-16">
            <Paywall
                isOpen={isPaywallOpen}
                onOpenChange={setIsPaywallOpen}
                feature="upgraded features"
                volumePricing={false}
            />
            <Card shadow="sm">
                <CardHeader>
                    <h4 className="font-medium">Billing</h4>
                </CardHeader>
                <CardBody>
                    <SubscriptionInfo onUpgradeClick={() => setIsPaywallOpen(true)} />
                </CardBody>
            </Card>
        </div>
    );
}

export default SettingsBillingTab;
