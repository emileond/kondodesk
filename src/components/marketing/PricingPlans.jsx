import { Button, ButtonGroup, Chip } from '@heroui/react';
import PricingCard from './PricingCard';
import { useState } from 'react';
import { useUser } from '../../hooks/react-query/user/useUser';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';

const subscriptionVariantIds = {
    personal: {
        monthly: import.meta.env.VITE_LEMON_SQUEEZY_PERSONAL_MONTHLY_ID,
        yearly: import.meta.env.VITE_LEMON_SQUEEZY_PERSONAL_YEARLY_ID,
    },
    team: {
        monthly: import.meta.env.VITE_LEMON_SQUEEZY_TEAM_MONTHLY_ID,
        yearly: import.meta.env.VITE_LEMON_SQUEEZY_TEAM_YEARLY_ID,
    },
};

const ltdVariantIds = {
    personal: import.meta.env.VITE_LEMON_SQUEEZY_PERSONAL_LTD_ID,
    team: import.meta.env.VITE_LEMON_SQUEEZY_TEAM_LTD_ID,
};

const subscriptionPlans = [
    {
        name: 'Personal Plan',
        price: 12,
        yearlyPrice: 108,
        features: [
            '1 User',
            '3 Guests',
            '2Gb Storage',
            'Smart planning',
            'AI-guided reflections',
            'Productivity & Mindfulness Tools',
            'Limited Integrations',
        ],
        variants: subscriptionVariantIds.personal,
    },
    {
        name: 'Team Plan',
        price: 49,
        yearlyPrice: 432,
        features: [
            '25 users',
            '100 guests',
            '250Gb Storage',
            'Smart Planning',
            'AI-guided reflections',
            'Productivity & Mindfulness Tools',
            'All Integrations',
            'API Access (soon)',
            'Custom Domain (soon)',
        ],
        highlight: true,
        variants: subscriptionVariantIds.team,
    },
];

const ltdPlans = [
    {
        name: 'Personal Plan',
        price: 69, // One-time price
        features: [
            '1 User',
            '3 Guests',
            '2Gb Storage',
            'Smart planning',
            'AI-guided reflections',
            'Integrations',
            'All Future Updates',
        ],
        variantId: ltdVariantIds.personal,
    },
    {
        name: 'Team Plan',
        price: 199, // One-time price
        features: [
            '20 Users',
            'Unlimited Guests',
            '200Gb Storage',
            'Collaboration features',
            'API access',
            'All Features in Personal',
            'All Future Updates',
        ],
        highlight: true,
        variantId: ltdVariantIds.team,
    },
];

// --- Helper Function ---
const constructCheckoutUrl = (variantId, email, workspaceId, userId) => {
    if (!variantId || !email || !workspaceId || !userId) return '/signup';
    const baseUrl = `https://weekfuse.lemonsqueezy.com/buy/${variantId}`;
    const params = new URLSearchParams({
        'checkout[email]': email,
        'checkout[custom][workspace_id]': workspaceId,
        'checkout[custom][user_id]': userId,
    });
    return `${baseUrl}?${params.toString()}`;
};

// --- Main Component ---
function PricingPlans({ showLTD = false }) {
    const [isYearly, setIsYearly] = useState(true);
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();

    const renderSubscriptionPlans = () => (
        <>
            <ButtonGroup size="sm" className="mb-3">
                <Button
                    color={isYearly ? 'primary' : 'default'}
                    variant={isYearly ? 'flat' : 'faded'}
                    endContent={
                        <Chip size="sm" color="primary">
                            Save 20%
                        </Chip>
                    }
                    onPress={() => setIsYearly(true)}
                >
                    Yearly
                </Button>
                <Button
                    color={isYearly ? 'default' : 'primary'}
                    variant={isYearly ? 'faded' : 'flat'}
                    onPress={() => setIsYearly(false)}
                >
                    Monthly
                </Button>
            </ButtonGroup>
            <div className="w-full flex flex-wrap justify-center gap-4">
                {subscriptionPlans.map((plan, index) => {
                    const variantId = isYearly ? plan.variants.yearly : plan.variants.monthly;
                    const checkoutUrl = constructCheckoutUrl(
                        variantId,
                        user?.email,
                        currentWorkspace?.workspace_id,
                        user?.id,
                    );
                    return (
                        <PricingCard
                            key={index}
                            name={plan.name}
                            price={plan.price}
                            yearlyPrice={plan.yearlyPrice}
                            isYearly={isYearly}
                            features={plan.features}
                            highlight={plan.highlight}
                            checkoutUrl={checkoutUrl}
                        />
                    );
                })}
            </div>
        </>
    );

    const renderLTDPlans = () => (
        <div className="w-full flex flex-wrap justify-center gap-4">
            {ltdPlans.map((plan, index) => {
                const checkoutUrl = constructCheckoutUrl(
                    plan.variantId,
                    user?.email,
                    currentWorkspace?.workspace_id,
                    user?.id,
                );
                return (
                    <PricingCard
                        key={index}
                        name={plan.name}
                        price={plan.price}
                        features={plan.features}
                        highlight={plan.highlight}
                        isLTD={showLTD}
                        checkoutUrl={checkoutUrl}
                    />
                );
            })}
        </div>
    );

    return showLTD ? renderLTDPlans() : renderSubscriptionPlans();
}

export default PricingPlans;
