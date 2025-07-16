import { Chip, User } from '@heroui/react';

const AsanaTaskDetails = ({ external_data }) => {
    const taskDueOn = external_data?.due_on;
    const taskAssignee = external_data?.assignee;
    const taskProjects = external_data?.projects || [];
    const taskTags = external_data?.tags || [];
    const taskCustomFields = external_data?.custom_fields || [];

    // Format due date
    const formatDueDate = (dateString) => {
        if (!dateString) return null;
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return dateString;
        }
    };

    return (
        <>
            {/* --- Due Date Section --- */}
            {taskDueOn && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Due Date</label>
                    <Chip color="default" variant="light">
                        {formatDueDate(taskDueOn)}
                    </Chip>
                </div>
            )}

            {/* --- Projects Section --- */}
            {taskProjects.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Projects</label>
                    <div className="flex flex-wrap gap-1">
                        {taskProjects.map((project) => (
                            <Chip key={project.gid} size="sm" color="primary" variant="flat">
                                {project.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Tags Section --- */}
            {taskTags.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Tags</label>
                    <div className="flex flex-wrap gap-1">
                        {taskTags.map((tag) => (
                            <Chip key={tag.gid} size="sm" color="secondary" variant="flat">
                                {tag.name}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Assignee Section --- */}
            {taskAssignee && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Assignee</label>
                    <div className="flex flex-wrap gap-1">
                        <User
                            name={taskAssignee.name}
                            avatarProps={{
                                src: taskAssignee.photo?.image_128x128,
                                size: 'sm',
                                className: 'w-6 h-6 text-tiny',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* --- Custom Fields Section --- */}
            {taskCustomFields.length > 0 && (
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Custom Fields</label>
                    <div className="space-y-1">
                        {taskCustomFields.map((field) => (
                            <div key={field.gid} className="flex items-center gap-2">
                                <span className="text-sm font-medium">{field.name}:</span>
                                <Chip size="sm" variant="light">
                                    {field.display_value ||
                                        field.text_value ||
                                        field.number_value ||
                                        'N/A'}
                                </Chip>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default AsanaTaskDetails;
