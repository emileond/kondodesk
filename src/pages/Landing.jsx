import Faq from '../components/marketing/Faq';
import Feature from '../components/marketing/Feature';
import Footer from '../components/marketing/Footer';
import NavBar from '../components/marketing/Nav';
import Pricing from '../components/marketing/Pricing';
import { ContainerScroll } from '../components/marketing/ContainerScroll.jsx';
import { OrbitingCircles } from '../components/marketing/OrbitCircles.jsx';
import BentoFeatures from '../components/marketing/BentoFeatures.jsx';
import AnimatedInsights from '../components/marketing/AnimatedInsights.jsx';

function LandingPage() {
    return (
        <div className="w-screen bg-content1">
            <NavBar />
            <ContainerScroll>
                <video autoPlay muted loop id="bgvid" src="/ui-demo.mp4"></video>
            </ContainerScroll>
            {/*<Hero />*/}
            <Feature
                id="features"
                chip="Integraciones"
                childComponent={<OrbitingCircles />}
                heading="Todas tus amenidades y avisos en un solo lugar."
                description="Kondodesk centraliza las reservas de gimnasio, canchas de tenis, terrazas y más, y te permite compartir comunicados con todos los residentes desde un mismo espacio."
            />

            <Feature
                reverse
                imageUrl="/planner.svg"
                chip="Reservas de amenidades"
                heading="Reserva en segundos."
                description="Agenda gimnasio, canchas, salones y terrazas sin choques de horario. Configuración sencilla, confirmaciones al instante."
            />
            <Feature
                chip="Avisos y comunicados"
                heading="Comunica a todos al instante."
                description="Publica anuncios importantes, reglamentos y novedades para que toda la comunidad esté informada por igual, sin chats perdidos."
                childComponent={<AnimatedInsights />}
            />
            <BentoFeatures />
            {/*<FeaturesGrid />*/}
            {/*<UseCases />*/}
            <Pricing isLanding />
            <Faq />
            <Footer />
        </div>
    );
}

export default LandingPage;
