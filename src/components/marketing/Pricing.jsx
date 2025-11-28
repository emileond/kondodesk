import VolumePricingCard from './VolumePricingCard';
import PricingPlans from './PricingPlans';
import CountdownTimer from './CountdownTimer.jsx';

function Pricing({ volumePricing = false, isLanding }) {
    return (
        <div id="pricing" className="w-full max-w-5xl mx-auto py-32 px-6 flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-center">Acceso de por vida por tiempo limitado</h2>
            <p className="text-center text-default-500">
                Olvídate de las suscripciones mensuales. Para celebrar nuestro lanzamiento, ofrecemos un
                pago único para obtener acceso de por vida a Kondodesk. Cuando termine esta promoción,
                volveremos a planes mensuales y anuales estándar.
            </p>
            <div className="py-6 mx-auto w-full max-w-5xl flex flex-col gap-6 items-center justify-center">
                <CountdownTimer targetDate="2025-09-30T12:00:00-07:00" />
                {volumePricing ? (
                    <VolumePricingCard isLanding={isLanding} />
                ) : (
                    <PricingPlans showLTD />
                )}
            </div>
            <p className="text-center text-sm text-default-500">Todos los precios están en USD.</p>
        </div>
    );
}

export default Pricing;
