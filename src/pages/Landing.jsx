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
                <img src="/ui-main.png" alt="UI" />
            </ContainerScroll>
            {/*<Hero />*/}
            <Feature
                id="features"
                chip="Integrations"
                childComponent={<OrbitingCircles />}
                heading="All Your Work, One Central Hub."
                description="Weekfuse seamlessly pulls in your tasks from where they already live to manage workload in one unified space."
            />

            <Feature
                reverse
                imageUrl="/planner.svg"
                chip="Weekly Planning"
                heading="Plan Smarter, Not Harder."
                description="Take control of your week with our intuitive planning tools. Weekfuse AI can suggest a weekly plan for you, considering your tasks and priorities."
            />
            <Feature
                chip="AI-Guided Reflections"
                heading="A Private Space to Grow."
                description="Journal your wins, frustrations, and ideas alongside your performance data. Our AI then helps you find the signal in the noise, offering gentle guidance for the week ahead."
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
