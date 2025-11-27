import {
    useDisclosure,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from '@heroui/react';
import { RiCalendarCloseLine } from 'react-icons/ri';
import TaskOptionsDropdown from './TaskOptionsDropdown';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import TaskDetailModalWrapper from './TaskDetailModalWrapper';
import { useState, useEffect } from 'react';
import EntityChip from '../common/EntityChip.jsx';
import dayjs from 'dayjs';
import IntegrationSourceIcon from './integrations/IntegrationSourceIcon.jsx';
import TaskCheckbox from './TaskCheckbox.jsx';
import { useDeleteTask } from '../../hooks/react-query/tasks/useTasks.js';

const TaskCard = ({ task, sm }) => {
    const [isCompleted, setIsCompleted] = useState(task?.status === 'completed');
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentWorkspace] = useCurrentWorkspace();
    const { mutateAsync: deleteTask } = useDeleteTask(currentWorkspace);
    const { isOpen, onOpenChange } = useDisclosure();
    const {
        isOpen: isDeleteModalOpen,
        onOpen: onDeleteModalOpen,
        onClose: onDeleteModalClose,
    } = useDisclosure();

    const taskDate = dayjs(task?.date);
    const today = dayjs().startOf('day');
    const isOverdue = taskDate.isBefore(today) && task.status === 'pending';

    // Update isCompleted state when task.status changes
    useEffect(() => {
        setIsCompleted(task?.status === 'completed');
    }, [task.status]);

    const handleAction = (key) => {
        switch (key) {
            case 'delete':
                onDeleteModalOpen();
                break;
            case 'move':
                break;
            default:
                null;
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteTask({ taskId: task.id });
            onDeleteModalClose();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
        setIsDeleting(false);
    };

    return (
        <>
            <TaskDetailModalWrapper isOpen={isOpen} onOpenChange={onOpenChange} task={task} />

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
                <ModalContent>
                    <ModalHeader>Delete Task</ModalHeader>
                    <ModalBody>
                        <p>
                            Are you sure you want to delete &#34;{task.name}&#34;? This action
                            cannot be undone.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onDeleteModalClose} isDisabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button color="danger" onPress={handleDelete} isLoading={isDeleting}>
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            <div
                id={task.id}
                className="w-full border border-content3 rounded-xl p-3 bg-content1 hover:bg-content2/50 transition-bg duration-300 ease-in-out cursor-grabbing hover:cursor-pointer"
                onClick={onOpenChange}
            >
                <div className="flex justify-between items-center">
                    <div className="flex gap-1 grow items-center">
                        <div onClick={(e) => e.stopPropagation()}>
                            <TaskCheckbox
                                task={task}
                                isCompleted={isCompleted}
                                onChange={(val) => setIsCompleted(val)}
                                sm={sm}
                            />
                        </div>
                        <span
                            className={`font-medium ${
                                isCompleted ? 'line-through text-default-400' : ''
                            } ${sm && 'text-sm'}`}
                        >
                            {task.name}
                        </span>
                    </div>
                    {isOverdue && !isCompleted && (
                        <span className="text-xs font-medium text-danger px-6 flex items-center gap-1">
                            <RiCalendarCloseLine fontSize="1rem" />
                            {Intl.DateTimeFormat(navigator.language, {
                                dateStyle: 'medium',
                            }).format(new Date(task?.date))}
                        </span>
                    )}
                    <TaskOptionsDropdown onAction={handleAction} sm={sm} />
                </div>
                {(task.project_id ||
                    task.milestone_id ||
                    task.tags ||
                    task.tag_id ||
                    (task.priority !== null && task.priority !== undefined) ||
                    task.integration_source) && (
                    <div className="flex gap-2 justify-end flex-wrap pt-2">
                        {task.project_id && (
                            <EntityChip
                                type="project"
                                entityId={task.project_id}
                                size="sm"
                                variant="light"
                            />
                        )}
                        {task.milestone_id && (
                            <EntityChip
                                type="milestone"
                                entityId={task.milestone_id}
                                size="sm"
                                variant="light"
                            />
                        )}
                        {task.tags && Array.isArray(task.tags) && task.tags.length > 0 ? (
                            <EntityChip type="tag" entityId={task.tags} size="sm" variant="light" />
                        ) : (
                            task.tag_id && (
                                <EntityChip
                                    type="tag"
                                    entityId={task.tag_id}
                                    size="sm"
                                    variant="light"
                                />
                            )
                        )}
                        {task.priority !== null && task.priority !== undefined && (
                            <EntityChip
                                type="priority"
                                entityId={task.priority}
                                size="sm"
                                variant="light"
                            />
                        )}
                        {task.integration_source && (
                            <IntegrationSourceIcon type={task.integration_source} />
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default TaskCard;
