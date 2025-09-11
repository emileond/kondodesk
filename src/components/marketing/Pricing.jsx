import VolumePricingCard from './VolumePricingCard';
import PricingPlans from './PricingPlans';
import CountdownTimer from './CountdownTimer.jsx';

function Pricing({ volumePricing = false, isLanding }) {
    return (
        <div id="pricing" className="w-full max-w-5xl mx-auto py-32 px-6 flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-center">Get Lifetime Access Before It's Gone</h2>
            <p className="text-center text-default-500">
                Forget monthly subscriptions. To celebrate our launch, we're offering a special
                one-time payment for lifetime access to Weekfuse. This isn't just a discount. When
                this launch offer ends, it will be replaced by standard monthly and annual plans.
            </p>
            <div className="py-6 mx-auto w-full max-w-5xl flex flex-col gap-6 items-center justify-center">
                <CountdownTimer targetDate="2025-09-30T12:00:00-07:00" />
                {volumePricing ? (
                    <VolumePricingCard isLanding={isLanding} />
                ) : (
                    <PricingPlans showLTD />
                )}
            </div>
            <p className="text-center text-sm text-default-500">All prices are in USD.</p>
        </div>
    );
}

export default Pricing;
