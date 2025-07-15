import { Accordion, AccordionItem } from '@heroui/react';

export default function Faq() {
    const accordionItems = [
        {
            title: 'I already use Trello, Notion, Monday, etc. How is Weekfuse different?',
            content: (
                <div className="text-muted-foreground py-1 space-y-6">
                    <p>
                        While tools like Notion and Monday are powerful for managing projects, they
                        are built around the project first. Weekfuse is built around you and your
                        time.
                    </p>
                    <p>Here’s how Weekfuse is different:</p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>A Single Source of Truth for Your Day</strong>
                            <p>
                                Instead of forcing you to live in a dozen different apps, Weekfuse
                                acts as your calm, central hub. We integrate with Trello, Jira,
                                GitHub, and more, pulling all your tasks into one unified view. This
                                isn't about replacing your team's tools; it's about giving you
                                personal clarity and control over your entire workload without the
                                constant app-hopping.
                            </p>
                        </li>
                        <li>
                            <strong>We Prioritize People, Not Just Projects</strong>
                            <p>
                                Traditional project management tools are excellent at tracking one
                                thing: work. But you are not a machine. Weekfuse is designed to
                                manage your most valuable resources: your time and energy. With
                                features like AI-powered weekly planning and reflection sessions, we
                                help you build sustainable habits, prevent burnout, and find a
                                healthy work/life balance—a focus you won't find in a Gantt chart.
                            </p>
                        </li>
                        <li>
                            <strong>Collaboration, Without the Chaos</strong>
                            <p>
                                We believe collaboration should bring clarity, not clutter. Instead
                                of throwing you into a sea of shared boards and notifications, our
                                features are designed for focused interaction. You start with your
                                personal plan and then intentionally delegate tasks, share progress,
                                or collaborate on specific items when needed. It’s about bringing
                                people into your focused workflow, not getting lost in theirs.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: 'Is Weekfuse a fit for me?',
            content: (
                <div className="text-muted-foreground py-1 space-y-6">
                    <p className="mb-6">
                        Weekfuse is designed for the ambitious individual who values both high
                        performance and personal well-being. If you're a knowledge worker,
                        freelancer, founder, or creative professional trying to build a sustainable
                        path to success, you're in the right place.
                    </p>

                    <p>We're the perfect fit if you find yourself nodding along to this:</p>

                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>You Juggle Multiple Projects </strong>
                            <p>
                                Your tasks aren't just from one source; they're from your 9-to-5,
                                your freelance gig, your personal projects, etc. You need a system
                                that can handle it all.
                            </p>
                        </li>
                        <li>
                            <strong>You're Tired of "App Sprawl"</strong>
                            <p>
                                Your to-dos are scattered across emails, Slack, Trello, Jira...
                                Creating more noise than clarity. You crave a single, calm place to
                                see what's on your plate.
                            </p>
                        </li>
                        <li>
                            <strong>You Seek Balance, Not Burnout</strong>
                            <p>
                                You believe productivity isn't just about doing more—it's about
                                doing what matters and having a life outside of work. You're looking
                                for a tool that actively prevents burnout.
                            </p>
                        </li>
                        <li>
                            <strong>You're Proactive, Not Reactive</strong>
                            <p>
                                You'd rather plan your week with intention and reflect on your
                                progress than spend your days constantly putting out fires.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: 'What integrations do you support?',
            content: (
                <div className="text-muted-foreground">
                    Weekfuse currently integrates with Jira, Trello, GitHub, ClickUp, Tick tick and
                    Todoist, with more integrations planned.
                </div>
            ),
        },
        {
            title: 'How does the AI Auto-Planning work?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p>
                        Our AI is your smart planning assistant. When you're ready, it looks at your
                        pending tasks, due dates, and other factors to help you plan your week.
                    </p>
                    <p>
                        Then, it quickly suggests a daily plan for your week. It helps you get
                        started fast, cuts down on decision fatigue, and you can always tweak it to
                        fit your day perfectly.
                    </p>
                </div>
            ),
        },
        {
            title: 'How does the AI-Guided Reflections work?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p>
                        Our AI helps you learn from your week. Instead of just checking off tasks,
                        it asks you thoughtful questions to hlp you really think about your
                        progress, spot patterns, and get ideas on how to improve your planning and
                        work habits. It's all about helping you grow and work smarter, not just
                        harder.
                    </p>
                </div>
            ),
        },
        {
            title: 'Is there research that supports this way of working?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p className="mb-6">
                        Absolutely. Weekfuse isn't based on fleeting trends; it's built on decades
                        of proven research in cognitive psychology and productivity. We’ve
                        integrated core principles from established methods into a single, intuitive
                        system.
                    </p>
                    <p>Here are the three research-backed pillars our platform is built on:</p>
                    <p className="mb-6">
                        <ul className="list-inside space-y-6">
                            <li>
                                <strong>Prioritize with Clarity (The 80/20 Rule)</strong>
                                <p>
                                    Our daily planning and timeblocking features are inspired by
                                    principles like the Pareto Principle (80/20 Rule), which states
                                    that roughly 80% of outcomes come from 20% of causes. Weekfuse
                                    guides you to identify and execute those few critical tasks that
                                    deliver the most impact, ensuring you're always moving the
                                    needle on what truly matters.
                                </p>
                            </li>
                            <li>
                                <strong>Build a Sustainable Rhythm (Energy Management)</strong>
                                Peak productivity isn't about non-stop grinding; it's about managing
                                your energy. We encourage work cycles that align with concepts like
                                the Pomodoro Technique—short bursts of deep focus followed by
                                restorative breaks. This approach is scientifically shown to improve
                                concentration and prevent the burnout that is common with
                                "always-on" work cultures.
                            </li>
                            <li>
                                <strong>Improve Through Reflection (Feedback Loops)</strong>
                                The fastest way to grow is to learn from your own experience.
                                Research consistently shows that deliberate reflection is one of the
                                most significant drivers of long-term performance improvement and
                                personal well-being.
                            </li>
                        </ul>
                    </p>
                    <p className="mb-6">
                        By combining these proven pillars with smart AI, Weekfuse provides a system
                        that doesn't just help you get work done—it helps you work smarter and
                        healthier.
                    </p>
                </div>
            ),
        },
        {
            title: "Why don't you offer a free plan?",
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p className="mb-6">
                        We&#39;ve made a deliberate choice to focus entirely on delivering a
                        high-quality experience for users truly committed to mastering their
                        productivity and work-life balance.
                    </p>
                    <p>Here’s what that means for you:</p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Focus on Value, Not Volume: </strong>
                            <p>
                                Running a &#34;freemium" model means splitting resources between a
                                free product and a paid one. By being a paid-only service, we can
                                dedicate every ounce of our effort—from our powerful AI features to
                                our dedicated customer support—to serving our members. You get a
                                better, more reliable product because you are our sole focus.
                            </p>
                        </li>
                        <li>
                            <strong>Our Business Model Aligns with Your Interests</strong>
                            <p>
                                Our subscription model is straightforward: we only succeed if you
                                find consistent value in Weekfuse. We don&#39;t have ads, and we
                                will never sell your data. Your subscription directly funds our
                                innovation and ensures we remain a long-term, trusted partner in
                                your journey, not just another app with a hidden agenda.
                            </p>
                        </li>
                        <li>
                            <strong>A Commitment to a Higher Standard</strong>
                            <p>
                                We are building a tool for individuals who are ready to invest in a
                                system that truly supports their goals and mental clarity. This
                                commitment from our users allows us to maintain a higher standard
                                for the product and the community.
                            </p>
                        </li>
                    </ul>
                    <p>
                        We do offer a <strong>full-featured 14-day free trial.</strong> So you can
                        experience everything Weekfuse has to offer, risk-free, and decide if
                        it&#39;s the right investment for you.
                    </p>
                </div>
            ),
        },
    ];

    return (
        <div id="faq" className="mx-auto max-w-3xl py-32">
            <div className="flex flex-col gap-3 justify-center items-center">
                <h4 className="text-2xl font-bold sm:text-3xl mb-9">Frequently Asked Questions</h4>
            </div>
            <div className="w-full">
                <Accordion fullWidth selectionMode="multiple" variant="shadow">
                    {accordionItems?.map((item, index) => (
                        <AccordionItem
                            key={index}
                            aria-label={item.title}
                            title={item.title}
                            className="font-medium "
                        >
                            <p className="font-normal text-default-700 text-md text-pretty pt-3 pb-6">
                                {item.content}
                            </p>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
