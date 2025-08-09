import IntegrationSourceIcon from '../integrations/IntegrationSourceIcon.jsx';
import { Link, Image, Divider } from '@heroui/react';
import JiraTaskDetails from './jira/JiraTaskDetails.jsx';
import GithubTaskDetails from './github/GithubTaskDetails.jsx';
import TrelloTaskDetails from './trello/TrelloTaskDetails.jsx';
import ClickupTaskDetails from './clickup/ClickupTaskDetails.jsx';
import TickTickTaskDetails from './ticktick/TickTickTaskDetails.jsx';
import TodoistTaskDetails from './todoist/TodoistTaskDetails.jsx';
import AsanaTaskDetails from './asana/AsanaTaskDetails.jsx';
import MicrosoftToDoTaskDetails from './microsoft/todo/MicrosoftToDoTaskDetails.jsx';
import GoogleTasksDetails from './google/tasks/GoogleTasksDetails.jsx';
import ZohoProjectsTaskDetails from './zoho/projects/ZohoProjectsTaskDetails.jsx';
import NiftyTaskDetails from './nifty/NiftyTaskDetails.jsx';
import AworkTaskDetails from './awork/AworkTaskDetails.jsx';

const TaskIntegrationLink = ({ source, external_data, host }) => {
    switch (source) {
        case 'asana':
            return (
                <Link
                    className="font-medium text-blue-700 text-sm"
                    isExternal
                    showAnchorIcon
                    href={external_data?.permalink_url}
                >
                    Open in Asana
                </Link>
            );
        case 'github':
            return (
                <Link
                    className="font-medium text-blue-700 text-sm"
                    isExternal
                    showAnchorIcon
                    href={external_data?.html_url}
                >
                    #{external_data?.number}
                </Link>
            );
        case 'jira': {
            const issueKey = external_data?.key;
            let webUrl = '#';

            if (issueKey && host) {
                const baseUrl = new URL(host);
                webUrl = `${baseUrl}/browse/${issueKey}`;
            }
            return (
                <div className="flex gap-1 items-center">
                    <Image src={external_data?.fields?.issuetype?.iconUrl} />
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={webUrl}
                    >
                        {issueKey}
                    </Link>
                </div>
            );
        }
        case 'trello':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={external_data?.shortUrl}
                    >
                        Open in Trello
                    </Link>
                </div>
            );
        case 'clickup':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={external_data?.url}
                    >
                        Open in ClickUp
                    </Link>
                </div>
            );

        case 'ticktick':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={`https://ticktick.com/webapp/#p/${external_data?.projectId}/tasks/${external_data?.id}`}
                    >
                        Open in TickTick
                    </Link>
                </div>
            );

        case 'todoist':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={external_data?.url}
                    >
                        Open in Todoist
                    </Link>
                </div>
            );
        case 'microsoft_todo':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={`https://to-do.office.com/tasks/${external_data?.listId}`}
                    >
                        Open in To Do
                    </Link>
                </div>
            );
        case 'google_tasks':
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={`https://tasks.google.com/task/${external_data?.id}`}
                    >
                        Open in Google Tasks
                    </Link>
                </div>
            );
        case 'zoho_projects': {
            const projectId = external_data?.project_id || external_data?.project?.id;
            const taskId = external_data?.id;
            let webUrl = '#';

            if (projectId && taskId) {
                webUrl = `https://projects.zoho.com/portal/weekfuse#projects/${projectId}/tasks/${taskId}`;
            }
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={webUrl}
                    >
                        Open in Zoho Projects
                    </Link>
                </div>
            );
        }
        case 'nifty': {
            const projectId = external_data?.project;
            const taskId = external_data?.id;
            let webUrl = '#';

            if (projectId && taskId) {
                webUrl = `https://nifty.pm/${projectId}/task/${taskId}`;
            }
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={webUrl}
                    >
                        {external_data?.nice_id}
                    </Link>
                </div>
            );
        }
        case 'awork': {
            const taskId = external_data?.id;
            let webUrl = '#';

            if (taskId) {
                webUrl = `https://app.awork.com/tasks/${taskId}`;
            }
            return (
                <div className="flex gap-1 items-center">
                    <Link
                        className="font-medium text-blue-700 text-sm"
                        isExternal
                        showAnchorIcon
                        href={webUrl}
                    >
                        Open in Awork
                    </Link>
                </div>
            );
        }
    }
};

export const TaskIntegrationDetails = ({ task_id, source, external_data }) => {
    switch (source) {
        case 'asana':
            return <AsanaTaskDetails external_data={external_data} />;
        case 'github':
            return <GithubTaskDetails external_data={external_data} />;

        case 'jira':
            return <JiraTaskDetails task_id={task_id} external_data={external_data} />;

        case 'trello':
            return <TrelloTaskDetails external_data={external_data} />;

        case 'clickup':
            return <ClickupTaskDetails external_data={external_data} />;

        case 'ticktick':
            return <TickTickTaskDetails task_id={task_id} external_data={external_data} />;

        case 'todoist':
            return <TodoistTaskDetails external_data={external_data} />;
        case 'microsoft_todo':
            return <MicrosoftToDoTaskDetails task_id={task_id} external_data={external_data} />;
        case 'google_tasks':
            return <GoogleTasksDetails task_id={task_id} external_data={external_data} />;
        case 'zoho_projects':
            return <ZohoProjectsTaskDetails task_id={task_id} external_data={external_data} />;
        case 'nifty':
            return <NiftyTaskDetails external_data={external_data} />;
        case 'awork':
            return <AworkTaskDetails external_data={external_data} />;
    }
};

const TaskIntegrationPanel = ({ source, task_id, external_data, host }) => {
    return (
        <div className="flex flex-col gap-6 bg-content2 basis-1/3 p-6 border-l-1 border-default-200">
            <div className="flex gap-3 items-center">
                <h4 className="font-semibold flex gap-1">
                    <IntegrationSourceIcon type={source} />{' '}
                    {source.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
                </h4>
                <TaskIntegrationLink source={source} external_data={external_data} host={host} />
            </div>
            <Divider />
            <TaskIntegrationDetails
                task_id={task_id}
                source={source}
                external_data={external_data}
            />
        </div>
    );
};

export default TaskIntegrationPanel;
