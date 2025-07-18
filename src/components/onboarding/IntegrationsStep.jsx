import JiraIntegrationCard from '../integrations/jira/JiraIntegrationCard.jsx';
import GithubIntegrationCard from '../integrations/github/GithubIntegrationCard.jsx';
import ClickupIntegrationCard from '../integrations/clickup/ClickupIntegrationCard.jsx';
import TrelloIntegrationCard from '../integrations/trello/TrelloIntegrationCard.jsx';
import TodoistIntegrationCard from '../integrations/todoist/TodoistIntegrationCard.jsx';
import { Button } from '@heroui/react';
import AsanaIntegrationCard from '../integrations/asana/AsanaIntegrationCard.jsx';

function IntegrationsStep({ goToNextStep }) {
    return (
        <div className="flex flex-col gap-3">
            <AsanaIntegrationCard isCompact />
            <JiraIntegrationCard isCompact />
            <GithubIntegrationCard isCompact />
            <ClickupIntegrationCard isCompact />
            <TrelloIntegrationCard isCompact />
            <TodoistIntegrationCard isCompact />
            <Button color="primary" onPress={goToNextStep}>
                Continue
            </Button>
        </div>
    );
}

export default IntegrationsStep;
