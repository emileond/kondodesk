import {
    Button,
    Checkbox,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSection,
    DropdownTrigger,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    useDisclosure,
} from '@heroui/react';
import { useState } from 'react';
import ky from 'ky';
import toast from 'react-hot-toast';
import { taskCompletedMessages } from '../../utils/toast-messages/taskCompleted.js';
import { RiArrowDownSLine, RiCheckboxCircleFill } from 'react-icons/ri';
import { useUserIntegration } from '../../hooks/react-query/integrations/useUserIntegrations.js';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import {
    useJiraTransitions,
    useJiraTransitionIssue,
} from '../../hooks/react-query/integrations/jira/useJiraTransitions.js';
import { useUpdateTask } from '../../hooks/react-query/tasks/useTasks.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';

const TaskCheckbox = ({ task, isCompleted, onChange, sm }) => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: integration } = useUserIntegration(user?.id, task?.integration_source);
    const { mutateAsync: updateTask } = useUpdateTask(currentWorkspace);
    const [isJiraTransitionLoading, setIsJiraTransitionLoading] = useState(false);
    const [isClickUpStatusLoading, setIsClickUpStatusLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { data: jiraTransitions } = useJiraTransitions({
        issueIdOrKey: task?.integration_source === 'jira' ? task?.external_id : null,
        user_id: user?.id,
        workspace_id: currentWorkspace?.workspace_id,
    });

    const { mutateAsync: transitionJiraIssue } = useJiraTransitionIssue();
    const {
        isOpen: isSyncModalOpen,
        onOpen: onSyncModalOpen,
        onClose: onSyncModalClose,
    } = useDisclosure();
    const {
        isOpen: isJiraTransitionsModalOpen,
        onOpen: onJiraTransitionsModalOpen,
        onClose: onJiraTransitionsModalClose,
    } = useDisclosure();
    const {
        isOpen: isClickUpStatusModalOpen,
        onOpen: onClickUpStatusModalOpen,
        onClose: onClickUpStatusModalClose,
    } = useDisclosure();

    const handleStatusToggle = async () => {
        const newCompleted = !isCompleted;
        const newStatus = newCompleted ? 'completed' : 'pending';

        // Optimistically update the UI
        onChange(newCompleted);

        const syncStatus = integration?.config?.syncStatus;

        if (task?.integration_source && syncStatus === 'prompt') {
            // If prompt is needed, just open the modal. No DB update here.
            switch (task.integration_source) {
                case 'jira':
                    return onJiraTransitionsModalOpen();
                case 'clickup':
                    return onClickUpStatusModalOpen();
                default:
                    return onSyncModalOpen();
            }
        } else {
            // For 'auto', 'never', or no integration, update immediately.
            await updateTaskStatus({ newStatus });
            if (syncStatus === 'auto') {
                await handleSourceStatusUpdate({ newStatus });
            }
        }
    };

    const handleSourceStatusUpdate = async ({ newStatus }) => {
        setIsLoading(true);
        switch (task?.integration_source) {
            case 'trello':
                try {
                    const state = newStatus;
                    await ky.patch('/api/trello/task', {
                        json: {
                            external_id: task.external_id,
                            state,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Trello task:', error);
                }
                break;

            case 'github':
                try {
                    const state = newStatus === 'completed' ? 'closed' : 'open';
                    await ky.patch('/api/github/task', {
                        json: {
                            external_id: task.external_id,
                            url: task.external_data?.url,
                            state,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating GitHub task:', error);
                }
                break;

            case 'ticktick':
                try {
                    const state = newStatus;
                    await ky.patch('/api/ticktick/task', {
                        json: {
                            external_id: task.external_id,
                            project_id: task?.external_data?.projectId,
                            state,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Tick Tick task:', error);
                }
                break;

            case 'todoist':
                try {
                    const state = newStatus;
                    await ky.patch('/api/todoist/task', {
                        json: {
                            external_id: task.external_id,
                            state,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Todoist task:', error);
                }
                break;

            case 'jira':
                // For Jira, we don't automatically update the status here
                // Instead, we show the transitions modal when syncStatus is "prompt"
                // and handle the transition in handleJiraTransition
                break;

            case 'clickup':
                // For ClickUp, we don't automatically update the status here when syncStatus is "prompt"
                // Instead, we show the status selection modal when syncStatus is "prompt"
                // and handle the status update in handleClickUpStatus
                break;

            case 'asana':
                try {
                    const completed = newStatus === 'completed';
                    await ky.put(`/api/asana/tasks/${task.external_id}`, {
                        json: {
                            completed,
                            user_id: user.id,
                            workspace_id: currentWorkspace?.workspace_id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Asana task:', error);
                }
                break;

            case 'google_tasks':
                try {
                    const taskListId = task?.external_data?.taskListId;
                    if (!taskListId) {
                        console.error('Missing taskListId for Google Tasks update');
                        break;
                    }

                    await ky.patch(`/api/google/tasks/${task.external_id}`, {
                        json: {
                            workspace_id: currentWorkspace?.workspace_id,
                            user_id: user.id,
                            taskListId: taskListId,
                            status: newStatus,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Google Tasks task:', error);
                }
                break;

            case 'microsoft_todo':
                try {
                    const listId = task?.external_data?.listId;
                    if (!listId) {
                        console.error('Missing listId for Microsoft To Do update');
                        break;
                    }

                    await ky.patch(`/api/microsoft/todo/task/${task.external_id}`, {
                        json: {
                            workspace_id: currentWorkspace?.workspace_id,
                            user_id: user.id,
                            listId: listId,
                            status: newStatus,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Microsoft To Do task:', error);
                }
                break;

            case 'zoho_projects':
                try {
                    const projectId =
                        task?.external_data?.project_id || task?.external_data?.project?.id;
                    if (!projectId) {
                        console.error('Missing projectId for Zoho Projects update');
                        break;
                    }

                    // Map status to Zoho Projects status ID
                    // This is a simplified mapping - in reality, you'd need to fetch available statuses
                    const statusId = newStatus === 'completed' ? 'completed' : 'open';

                    await ky.post('/api/zoho/projects/transitions', {
                        json: {
                            task_id: task.id,
                            taskId: task.external_id,
                            projectId: projectId,
                            statusId: statusId,
                            user_id: user.id,
                            workspace_id: currentWorkspace?.workspace_id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Zoho Projects task:', error);
                }
                break;

            case 'nifty':
                try {
                    const state = newStatus;
                    await ky.patch('/api/nifty/task', {
                        json: {
                            external_id: task.external_id,
                            state,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Nifty task:', error);
                }
                break;

            case 'awork':
                try {
                    const taskStatusType = newStatus === 'completed' ? 'done' : 'progress';
                    await ky.patch('/api/awork/task', {
                        json: {
                            external_id: task.external_id,
                            taskStatusType,
                            user_id: user.id,
                        },
                    });
                } catch (error) {
                    console.error('Error updating Awork task:', error);
                }
                break;
        }
        setIsLoading(false);
    };

    const handleSyncConfirm = async () => {
        const newStatus = isCompleted ? 'completed' : 'pending';
        await updateTaskStatus({ newStatus });
        await handleSourceStatusUpdate({ newStatus });
        onSyncModalClose();
    };

    const handleSyncDecline = async () => {
        const newStatus = isCompleted ? 'completed' : 'pending';
        await updateTaskStatus({ newStatus });
        onSyncModalClose();
    };

    const handleJiraTransition = async (transitionId) => {
        setIsJiraTransitionLoading(true);
        try {
            await transitionJiraIssue({
                task_id: task.id,
                issueIdOrKey: task?.external_id,
                transitionId,
                user_id: user?.id,
                workspace_id: currentWorkspace?.workspace_id,
            });
            toast.success('Jira status updated');
            onJiraTransitionsModalClose();
        } catch (error) {
            toast.error(error.message || 'Failed to update Jira status');
        } finally {
            setIsJiraTransitionLoading(false);
        }
    };

    const handleClickUpStatus = async (status) => {
        setIsClickUpStatusLoading(true);
        try {
            await ky.patch('/api/clickup/task', {
                json: {
                    external_id: task.external_id,
                    status,
                    user_id: user.id,
                },
            });
            toast.success('ClickUp status updated');
            onClickUpStatusModalClose();
        } catch (error) {
            toast.error(error.message || 'Failed to update ClickUp status');
        } finally {
            setIsClickUpStatusLoading(false);
        }
    };

    const updateTaskStatus = async ({ newStatus }) => {
        let wasCompleted = false;
        try {
            await updateTask({
                taskId: task.id,
                updates: {
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
                },
            });
            if (newStatus === 'completed') {
                wasCompleted = true;
            }
        } catch (error) {
            onChange(newStatus !== 'completed'); // Revert optimistic UI on error
            console.error('Error toggling task status:', error);
        }

        // The toast is now triggered manually after the DB update is successful.
        if (wasCompleted) {
            const randomMessage =
                taskCompletedMessages[Math.floor(Math.random() * taskCompletedMessages.length)];
            toast.success(randomMessage.message, {
                duration: 5000,
                icon: randomMessage?.icon || (
                    <RiCheckboxCircleFill className="text-success" fontSize="2rem" />
                ),
                style: {
                    fontWeight: 500,
                },
            });
        }
    };

    return (
        <>
            <Checkbox
                size={sm ? 'md' : 'lg'}
                isSelected={isCompleted}
                onValueChange={handleStatusToggle}
            />
            {/* Sync Status Modal */}
            <Modal isOpen={isSyncModalOpen} onClose={onSyncModalClose}>
                <ModalContent>
                    <ModalHeader>Update External Task</ModalHeader>
                    <ModalBody>
                        <p>
                            Do you want to update the status in {task?.integration_source} as well?
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={handleSyncDecline} isDisabled={isLoading}>
                            No
                        </Button>
                        <Button color="primary" onPress={handleSyncConfirm} isLoading={isLoading}>
                            Yes, Update
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Jira Transitions Modal */}
            <Modal isOpen={isJiraTransitionsModalOpen} onClose={onJiraTransitionsModalClose}>
                <ModalContent>
                    <ModalHeader>Update Jira Status</ModalHeader>
                    <ModalBody>
                        <p className="mb-3">Do you want to move the issue in Jira?</p>
                        <div>
                            <p className="mb-1 text-sm font-medium">Status:</p>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        className="font-medium w-full"
                                        endContent={<RiArrowDownSLine fontSize="1rem" />}
                                        isLoading={isJiraTransitionLoading}
                                    >
                                        {task?.external_data?.fields?.status?.name ||
                                            'Select status'}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu>
                                    <DropdownSection title="Move to:">
                                        {jiraTransitions?.map((item) => (
                                            <DropdownItem
                                                key={item.id}
                                                onPress={() => handleJiraTransition(item.id)}
                                            >
                                                {item.name}
                                            </DropdownItem>
                                        ))}
                                    </DropdownSection>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onJiraTransitionsModalClose}>
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* ClickUp Status Modal */}
            <Modal
                isOpen={isClickUpStatusModalOpen}
                onClose={onClickUpStatusModalClose}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalContent>
                    <ModalHeader>Update ClickUp Status</ModalHeader>
                    <ModalBody>
                        <p className="mb-3">Do you want to move the task in ClickUp?</p>
                        <div>
                            <p className="mb-1 text-sm font-medium">Status:</p>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        className="font-medium w-full"
                                        endContent={<RiArrowDownSLine fontSize="1rem" />}
                                        isLoading={isClickUpStatusLoading}
                                    >
                                        {task?.external_data?.status?.status || 'Select status'}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu>
                                    <DropdownSection title="Move to:">
                                        <DropdownItem onPress={() => handleClickUpStatus('to do')}>
                                            To Do
                                        </DropdownItem>
                                        <DropdownItem
                                            onPress={() => handleClickUpStatus('in progress')}
                                        >
                                            In Progress
                                        </DropdownItem>
                                        <DropdownItem
                                            onPress={() => handleClickUpStatus('complete')}
                                        >
                                            Complete
                                        </DropdownItem>
                                    </DropdownSection>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onClickUpStatusModalClose}>
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default TaskCheckbox;
