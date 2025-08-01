import VolumePricingCard from './VolumePricingCard';
import PricingPlans from './PricingPlans';
import CountdownTimer from './CountdownTimer.jsx';

function Pricing({ volumePricing = false, isLanding }) {
    return (
        <div id="pricing" className="w-full max-w-5xl mx-auto py-32 px-6 flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-center">Find the Right Plan for You</h2>
            <p className="text-center text-default-500">
                Our flexible subscription plans are designed to help you build lasting habits for
                focus and well-being. Each plan includes continuous updates and support. Select the
                option that best fits your journey.
            </p>
            <div className="py-6 mx-auto w-full max-w-5xl flex flex-col gap-6 items-center justify-center">
                {/*<CountdownTimer targetDate="2025-08-01T12:00:00-07:00" />*/}
                {volumePricing ? <VolumePricingCard isLanding={isLanding} /> : <PricingPlans />}
            </div>
            <p className="text-center text-sm text-default-500">All prices are in USD.</p>
        </div>
    );
}

export default Pricing;
