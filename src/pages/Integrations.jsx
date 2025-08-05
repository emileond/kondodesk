import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import IntegrationCard from '../components/integrations/IntegrationCard';
import { RiGithubFill, RiSlackFill } from 'react-icons/ri';
import { Link, Tabs, Tab } from '@heroui/react';
import GithubIntegrationCard from '../components/integrations/github/GithubIntegrationCard.jsx';
import JiraIntegrationCard from '../components/integrations/jira/JiraIntegrationCard.jsx';
import TrelloIntegrationCard from '../components/integrations/trello/TrelloIntegrationCard.jsx';
import ClickupIntegrationCard from '../components/integrations/clickup/ClickupIntegrationCard.jsx';
import MondayIntegrationCard from '../components/integrations/monday/MondayIntegrationCard.jsx';
import TickTickIntegrationCard from '../components/integrations/ticktick/TickTickIntegrationCard.jsx';
import TodoistIntegrationCard from '../components/integrations/todoist/TodoistIntegrationCard.jsx';
import AsanaIntegrationCard from '../components/integrations/asana/AsanaIntegrationCard.jsx';
import MicrosoftToDoIntegrationCard from '../components/integrations/microsoft/todo/MicrosoftToDoIntegrationCard.jsx';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useState } from 'react';
import GoogleTasksIntegrationCard from '../components/integrations/google/tasks/GoogleTasksIntegrationCard.jsx';
import ZohoProjectsIntegrationCard from '../components/integrations/zoho/projects/ZohoProjectsIntegrationCard.jsx';
import NiftyIntegrationCard from '../components/integrations/nifty/NiftyIntegrationCard.jsx';

function IntegrationsPage() {
    const { data: user } = useUser();
    const [activeTab, setActiveTab] = useState('task-management');

    // Define all integrations with GitHub having dynamic status and handlers
    const integrations = [
        {
            id: 'slack',
            name: 'Slack',
            icon: <RiSlackFill />,
            status: 'soon',
            description: 'Get notifications and updates directly in your Slack channels.',
            hasConfigOptions: false,
        },
        {
            id: 'zapier',
            name: 'Zapier',
            icon: <RiGithubFill />,
            status: 'soon',
            description: 'Connect with thousands of apps through Zapier automations.',
            hasConfigOptions: true,
        },
    ];

    return (
        <AppLayout>
            <PageLayout title="Integrations" maxW="6xl">
                <p className="mb-6">
                    Have a suggestion? Add it to the{' '}
                    <Link
                        href={`${import.meta.env.VITE_PUBLIC_URL}/feature-requests`}
                        isExternal
                        showAnchorIcon
                    >
                        Feature Requests Board
                    </Link>
                </p>

                <Tabs selectedKey={activeTab} onSelectionChange={setActiveTab} className="w-full">
                    <Tab key="task-management" title="Task Management">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            <AsanaIntegrationCard />
                            <ClickupIntegrationCard />
                            <GithubIntegrationCard />
                            {user?.email === 'sonarart@gmail.com' && <GoogleTasksIntegrationCard />}
                            <JiraIntegrationCard />
                            <TickTickIntegrationCard />
                            <TodoistIntegrationCard />
                            <TrelloIntegrationCard />
                            <MicrosoftToDoIntegrationCard />
                            <NiftyIntegrationCard />
                            {user?.email === 'sonarart@gmail.com' && (
                                <ZohoProjectsIntegrationCard />
                            )}
                            {/*<MondayIntegrationCard />*/}
                        </div>
                    </Tab>

                    <Tab key="calendar" title="Calendar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            {/* Calendar integrations will be added here in the future */}
                            <div className="col-span-full text-center py-8 text-gray-500">
                                Calendar integrations coming soon!
                            </div>
                        </div>
                    </Tab>

                    <Tab key="communication" title="Communication">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            {integrations
                                .filter((integration) => integration.id === 'slack')
                                .map((integration) => (
                                    <IntegrationCard
                                        key={integration.id}
                                        id={integration.id}
                                        name={integration.name}
                                        icon={integration.icon}
                                        status={integration.status}
                                        description={integration.description}
                                        hasConfigOptions={integration.hasConfigOptions}
                                        onConnect={integration.onConnect}
                                        onDisconnect={integration.onDisconnect}
                                        onConfigure={integration.onConfigure}
                                    />
                                ))}
                        </div>
                    </Tab>

                    <Tab key="automation" title="Automation">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                            {integrations
                                .filter((integration) => integration.id === 'zapier')
                                .map((integration) => (
                                    <IntegrationCard
                                        key={integration.id}
                                        id={integration.id}
                                        name={integration.name}
                                        icon={integration.icon}
                                        status={integration.status}
                                        description={integration.description}
                                        hasConfigOptions={integration.hasConfigOptions}
                                        onConnect={integration.onConnect}
                                        onDisconnect={integration.onDisconnect}
                                        onConfigure={integration.onConfigure}
                                    />
                                ))}
                        </div>
                    </Tab>
                </Tabs>
            </PageLayout>
        </AppLayout>
    );
}

export default IntegrationsPage;
