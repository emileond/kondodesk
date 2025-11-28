import { Button, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter } from '@heroui/react';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useUpdateTask } from '../../hooks/react-query/tasks/useTasks.js';
import { useTasksAttachments } from '../../hooks/react-query/tasks/useTasksAttachments.js';
import { useQueryClient } from '@tanstack/react-query';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import toast from 'react-hot-toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from '../../components/form/DatePicker';
import ProjectSelect from '../form/ProjectSelect.jsx';
import MilestoneSelect from '../form/MilestoneSelect.jsx';
import TagSelect from '../form/TagSelect.jsx';
import PrioritySelect from '../form/PrioritySelect.jsx';
import SimpleEditor from '../form/SimpleEditor.jsx';
import { RiCheckboxCircleLine, RiUpload2Line } from 'react-icons/ri';
import TaskIntegrationPanel from './integrations/TaskIntegrationPanel.jsx';
import TaskIntegrationDescription from './integrations/TaskIntegrationDescription.jsx';
import TaskCheckbox from './TaskCheckbox.jsx';
import { markdownToTipTap } from '../../utils/editorUtils.js';
import UserSelect from '../form/UserSelect.jsx';
import { useWorkspaceMembers } from '../../hooks/react-query/condos/useWorkspaceMembers.js';
import ky from 'ky';
import AttachmentChip from './AttachmentChip.jsx';
import TaskOptionsDropdown from './TaskOptionsDropdown.jsx';

const TaskDetailModal = ({ isOpen, onOpenChange, task, onAction }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { mutateAsync: updateTask, isPending } = useUpdateTask(currentWorkspace);
    const { data: members } = useWorkspaceMembers(currentWorkspace);
    const { data: attachments = [] } = useTasksAttachments(task?.id);
    const queryClient = useQueryClient();
    const [currentStatus, setCurrentStatus] = useState(task.status);
    const [selectedDate, setSelectedDate] = useState(task?.date ? new Date(task.date) : null);
    const [description, setDescription] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedMilestone, setSelectedMilestone] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedPriority, setSelectedPriority] = useState(null);
    const [isNameEditing, setIsNameEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Memoize this value to avoid recalculation on every render
    const isExternal = useMemo(() => !!task?.integration_source, [task?.integration_source]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            name: task?.name || '',
            description: task?.description || '',
            date: task?.date ? new Date(task.date) : null,
        },
    });

    // Reset form when modal opens/closes - optimized to reduce unnecessary state updates
    useEffect(() => {
        if (isOpen && task) {
            // Use a single batch update for all form fields
            const taskDate = task.date ? new Date(task.date) : null;

            // Prepare tags data
            let tagsData = [];
            if (task.tags && Array.isArray(task.tags)) {
                tagsData = task.tags;
            } else if (task.tags) {
                tagsData = [task.tags];
            }

            // Prepare priority data
            const priorityData =
                task.priority !== null && task.priority !== undefined
                    ? { value: task.priority }
                    : null;

            // Reset all form fields at once
            reset({
                name: task.name || '',
                date: taskDate,
            });

            let initialDescription = null;
            if (task.description && typeof task.description === 'string') {
                try {
                    initialDescription = JSON.parse(task.description);
                } catch (e) {
                    console.error('Failed to parse description, treating as plain text:', e);
                    // This is a fallback if you have non-JSON data
                    initialDescription = markdownToTipTap(task.description);
                }
            }

            // Batch state updates for better performance
            setSelectedUser(task?.assignee);
            setDescription(initialDescription);
            setSelectedDate(taskDate);
            setCurrentStatus(task.status || 'pending');
            setSelectedProject(task.project_id ? { value: task.project_id } : null);
            setSelectedMilestone(task.milestone_id ? { value: task.milestone_id } : null);
            setSelectedTags(tagsData);
            setSelectedPriority(priorityData);
            setIsNameEditing(false);
        }
    }, [isOpen, task, reset, members]);

    // Helper function to compare tags arrays - moved outside onSubmit and memoized
    const areTagsEqual = useCallback((tags1, tags2) => {
        if (!tags1 && !tags2) return true;
        if (!tags1 || !tags2) return false;
        if (!Array.isArray(tags1) || !Array.isArray(tags2)) return false;
        if (tags1.length !== tags2.length) return false;

        // Sort both arrays to ensure consistent comparison
        const sortedTags1 = [...tags1].sort();
        const sortedTags2 = [...tags2].sort();

        return sortedTags1.every((tag, index) => tag === sortedTags2[index]);
    }, []);

    // Handle file selection and upload
    const handleFileSelect = useCallback(
        async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            setIsUploading(true);
            const uploadPromises = Array.from(files).map(async (file) => {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('task_id', task.id);
                    formData.append('workspace_id', currentWorkspace?.workspace_id);

                    return await ky
                        .post('/api/task/attachments', {
                            body: formData,
                        })
                        .json();
                } catch (error) {
                    console.error('Error uploading file:', error);
                    toast.error(`Failed to upload ${file.name}`);
                    return null;
                } finally {
                    queryClient.invalidateQueries({ queryKey: ['taskAttachments', task.id] });
                }
            });

            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter(Boolean);

            if (successfulUploads.length > 0) {
                // The attachment details are now saved by the API endpoint
                // No need to add them to the database here
                toast.success(`${successfulUploads.length} file(s) uploaded successfully`);
            }

            setIsUploading(false);
        },
        [task.id, currentWorkspace?.workspace_id, queryClient],
    );

    const handleAttachmentClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onSubmit = async (data) => {
        try {
            // Create the updates object
            const updates = {
                name: data.name,
                status: currentStatus,
                description: description ? JSON.stringify(description) : null,
                date: selectedDate ? dayjs(selectedDate).toISOString() : null,
                project_id: selectedProject?.value || null,
                milestone_id: selectedMilestone?.value || null,
                tags: selectedTags.length > 0 ? selectedTags : null,
                priority:
                    selectedPriority?.value !== null && selectedPriority?.value !== undefined
                        ? parseInt(selectedPriority.value)
                        : null,
                assignee: selectedUser || null,
            };

            // Check if the data has actually changed
            const hasDescriptionChanged =
                (updates.description || null) !== (task.description || null);

            // Attachments are now managed separately through the useTasksAttachments hook

            const hasChanged =
                updates.name !== (task.name || '') ||
                hasDescriptionChanged ||
                (updates.date !== (task.date || null) &&
                    (updates.date === null ||
                        task.date === null ||
                        dayjs(updates.date).format('YYYY-MM-DD') !==
                            dayjs(task.date).format('YYYY-MM-DD'))) ||
                updates.project_id !== (task.project_id || null) ||
                updates.milestone_id !== (task.milestone_id || null) ||
                updates.priority !== task.priority ||
                updates.assignee !== (task.assignee || null) ||
                !areTagsEqual(updates.tags, task.tags);

            // Only make the database call if the data has changed
            if (hasChanged) {
                await updateTask({
                    taskId: task.id,
                    updates,
                });
            }
            toast.success('Task updated');
        } catch (error) {
            toast.error(error.message || 'Failed to update task');
        } finally {
            onOpenChange();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size={isExternal ? '5xl' : '4xl'}
            scrollBehavior="inside"
            className="rounded-xl overflow-hidden"
        >
            <ModalContent>
                <div className="flex gap-6">
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="basis-2/3 grow overflow-y-auto flex flex-col"
                    >
                        <ModalBody className="basis-4/5 grow pt-6 overflow-y-auto max-h-[75vh]">
                            <div className="flex flex-col gap-6 ">
                                <div className="flex">
                                    <TaskCheckbox
                                        task={task}
                                        isCompleted={currentStatus === 'completed'}
                                        onChange={(isNowCompleted) => {
                                            // If the user checks the box, it's 'completed'.
                                            // If they uncheck it, it becomes 'pending'.
                                            // The 'in progress' status is preserved unless this checkbox is touched.
                                            setCurrentStatus(
                                                isNowCompleted ? 'completed' : 'pending',
                                            );
                                        }}
                                    />
                                    {isNameEditing && !isExternal ? (
                                        <Input
                                            size="lg"
                                            variant="underlined"
                                            {...register('name', { required: true })}
                                            label="Task"
                                            color="primary"
                                            isInvalid={!!errors.name}
                                            errorMessage="Task name is required"
                                            autoFocus
                                            onBlur={() => setIsNameEditing(false)}
                                            classNames={{
                                                inputWrapper: 'shadow-none border-0',
                                                input: 'text-xl font-medium',
                                                label: 'text-default-600 font-normal',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="flex flex-col w-full p-1 cursor-text hover:bg-content2"
                                            onClick={() => !isExternal && setIsNameEditing(true)}
                                        >
                                            <h4 className="text-xl font-medium">{watch('name')}</h4>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <SimpleEditor
                                        label="Description"
                                        defaultContent={description || null}
                                        onChange={setDescription}
                                        isEditable={!isExternal}
                                        taskName={watch('name')}
                                        tags={selectedTags}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm block font-medium text-foreground">
                                            Attachments
                                        </span>
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="light"
                                            startContent={<RiUpload2Line className="text-[1rem]" />}
                                            onPress={handleAttachmentClick}
                                            isLoading={isUploading}
                                            isIconOnly
                                        />
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                            multiple
                                        />
                                    </div>
                                    {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-3">
                                            {attachments.map((file) => (
                                                <AttachmentChip
                                                    key={file.id}
                                                    id={file.id}
                                                    task_id={task.id}
                                                    name={file?.name}
                                                    url={file?.url}
                                                    type={file?.type}
                                                    size={file?.size}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {task?.integration_source && (
                                    <TaskIntegrationDescription
                                        source={task?.integration_source}
                                        external_data={task?.external_data}
                                    />
                                )}
                                <div className="flex items-center justify-between pb-1">
                                    <div className="flex gap-2">
                                        <DatePicker
                                            value={selectedDate}
                                            onChange={setSelectedDate}
                                        />
                                        <ProjectSelect
                                            defaultValue={task?.project_id}
                                            onChange={setSelectedProject}
                                        />
                                        {selectedProject && (
                                            <MilestoneSelect
                                                key={selectedProject?.value}
                                                defaultValue={
                                                    selectedProject?.value === task?.project_id
                                                        ? task?.milestone_id
                                                        : null
                                                }
                                                onChange={setSelectedMilestone}
                                                projectId={selectedProject?.value}
                                            />
                                        )}
                                        <TagSelect
                                            defaultValue={task?.tags || task?.tag_id}
                                            onChange={setSelectedTags}
                                            multiple={true}
                                        />
                                        <PrioritySelect
                                            defaultValue={task?.priority}
                                            onChange={setSelectedPriority}
                                        />
                                        <UserSelect
                                            defaultValue={task?.assignee}
                                            onChange={setSelectedUser}
                                            disabled={isExternal}
                                        />
                                    </div>
                                </div>
                            </div>
                        </ModalBody>
                        <Divider />
                        <ModalFooter className="flex justify-between">
                            <div>
                                {task.status === 'completed' && task.completed_at && (
                                    <div className="flex gap-1 text-xs text-default-500 font-medium">
                                        <RiCheckboxCircleLine fontSize="1rem" />
                                        Completed on{' '}
                                        {Intl.DateTimeFormat(navigator.language, {
                                            dateStyle: 'medium',
                                        }).format(new Date(task.completed_at))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="light"
                                    onPress={() => {
                                        onOpenChange(false);
                                        reset();
                                    }}
                                    isDisabled={isPending}
                                >
                                    Cancel
                                </Button>
                                <Button color="primary" type="submit" isLoading={isPending}>
                                    Save Changes
                                </Button>
                                <TaskOptionsDropdown onAction={onAction} />
                            </div>
                        </ModalFooter>
                    </form>
                    {task?.integration_source && (
                        <TaskIntegrationPanel
                            task_id={task.id}
                            source={task.integration_source}
                            external_id={task?.external_id}
                            external_data={task?.external_data}
                            host={task?.host}
                        />
                    )}
                </div>
            </ModalContent>
        </Modal>
    );
};

export default TaskDetailModal;
