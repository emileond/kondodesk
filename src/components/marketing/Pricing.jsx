import VolumePricingCard from './VolumePricingCard';
import PricingPlans from './PricingPlans';
import CountdownTimer from './CountdownTimer.jsx';

function Pricing({ volumePricing = false, isLanding }) {
    return (
        <div id="pricing" className="w-full max-w-5xl mx-auto py-32 px-6 flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-center">Launch Week Special Pricing</h2>
            <p className="text-center text-default-500">
                To celebrate our launch, we&#39;re replacing our regular plans with a one-time
                lifetime deal. This is your only chance to get lifetime access to Weekfuse—including
                all future updates—for a single payment.
            </p>
            <div className="py-6 mx-auto w-full max-w-5xl flex flex-col gap-6 items-center justify-center">
                <CountdownTimer targetDate="2025-08-01T12:00:00-07:00" />
                {volumePricing ? <VolumePricingCard isLanding={isLanding} /> : <PricingPlans />}
            </div>
            <p className="text-center text-sm text-default-500">All prices are in USD.</p>
        </div>
    );
}

export default Pricing;
