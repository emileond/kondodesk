import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import ProjectSelect from '../form/ProjectSelect.jsx';
import MilestoneSelect from '../form/MilestoneSelect.jsx';
import TagSelect from '../form/TagSelect.jsx';
import IntegrationSourceSelect from '../form/IntegrationSourceSelect.jsx';
import PrioritySelect from '../form/PrioritySelect.jsx';
import StatusSelect from '../form/StatusSelect.jsx';
import { RiFilterOffLine } from 'react-icons/ri';
import UserSelect from '../form/UserSelect.jsx';

function TasksFilters({
    onFiltersChange,
    onShowFiltersChange,
    initialFilters = {},
    showStatusFilter = false,
    showProjectFilter = true,
    showMilestoneFilter = true,
    preserveProjectFilter = false,
    preserveMilestoneFilter = false,
    defaultToAllUsers,
}) {
    // Filter state variables
    const [selectedProject, setSelectedProject] = useState(initialFilters.project_id || null);
    const [selectedMilestone, setSelectedMilestone] = useState(initialFilters.milestone_id || null);
    const [selectedTags, setSelectedTags] = useState(initialFilters.tags || []);
    const [selectedIntegrationSource, setSelectedIntegrationSource] = useState(
        initialFilters.integration_source || null,
    );
    const [selectedPriority, setSelectedPriority] = useState(
        initialFilters.priority ? { key: initialFilters.priority.toString() } : null,
    );
    const [selectedStatuses, setSelectedStatuses] = useState(initialFilters.statuses || null);
    const [selectedAssignees, setSelectedAssignees] = useState(initialFilters.statuses || []);
    const [resetKey, setResetKey] = useState(0); // Add a key to force re-render of filter components

    // Set initial filters visibility (always visible now)
    useEffect(() => {
        if (onShowFiltersChange) {
            onShowFiltersChange(true);
        }
    }, [onShowFiltersChange]);

    // Update parent component when filters change
    useEffect(() => {
        if (onFiltersChange) {
            const filters = {
                project_id: selectedProject,
                milestone_id: selectedMilestone,
                tags: selectedTags.length > 0 ? selectedTags : null,
                integration_source: selectedIntegrationSource,
                priority: selectedPriority?.key ? parseInt(selectedPriority.key) : null,
                statusList: selectedStatuses,
                assignees: selectedAssignees.length > 0 ? selectedAssignees : null,
            };
            onFiltersChange(filters);
        }
    }, [
        selectedProject,
        selectedMilestone,
        selectedTags,
        selectedIntegrationSource,
        selectedPriority,
        selectedStatuses,
        selectedAssignees,
        onFiltersChange,
    ]);

    // Clear all filters
    const clearFilters = () => {
        // Only clear project filter if not preserved
        if (!preserveProjectFilter) {
            setSelectedProject(null);
        }

        // Only clear milestone filter if not preserved
        if (!preserveMilestoneFilter) {
            setSelectedMilestone(null);
        }

        // Always clear these filters
        setSelectedTags([]);
        setSelectedIntegrationSource(null);
        setSelectedPriority(null);
        setSelectedStatuses(null);
        setSelectedAssignees([]);

        setResetKey((prevKey) => prevKey + 1); // Increment reset key to force re-render
    };

    // Check if any filter is active
    const hasActiveFilters =
        selectedProject ||
        selectedMilestone ||
        selectedTags.length > 0 ||
        selectedIntegrationSource ||
        selectedPriority ||
        selectedStatuses ||
        selectedAssignees.length > 0;

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 py-1">
                {showProjectFilter && (
                    <ProjectSelect
                        key={`project-select-${resetKey}`}
                        onChange={(value) => setSelectedProject(value?.value || null)}
                        defaultValue={selectedProject ? { value: selectedProject } : null}
                        triggerClassName={
                            selectedProject &&
                            'text-default-800 bg-default-100 border border-default-300'
                        }
                    />
                )}
                {selectedProject && showMilestoneFilter && (
                    <MilestoneSelect
                        key={`milestone-select-${selectedProject}-${resetKey}`}
                        projectId={selectedProject}
                        onChange={(value) => setSelectedMilestone(value?.value || null)}
                        defaultValue={selectedMilestone ? { value: selectedMilestone } : null}
                        triggerClassName={
                            selectedMilestone &&
                            'text-default-800 bg-default-100 border border-default-300'
                        }
                    />
                )}
                <TagSelect
                    key={`tag-select-${resetKey}`}
                    onChange={setSelectedTags}
                    multiple={true}
                    defaultValue={
                        selectedTags.length > 0 ? selectedTags.map((tag) => ({ value: tag })) : []
                    }
                    triggerClassName={
                        selectedTags.length > 0 &&
                        'text-default-800 bg-default-100 border border-default-300'
                    }
                />
                <IntegrationSourceSelect
                    key={`integration-source-select-${resetKey}`}
                    onChange={setSelectedIntegrationSource}
                    defaultValue={
                        selectedIntegrationSource ? { value: selectedIntegrationSource } : null
                    }
                    triggerClassName={
                        selectedIntegrationSource &&
                        'text-default-800 bg-default-100 border border-default-300'
                    }
                />
                {showStatusFilter && (
                    <StatusSelect
                        key={`status-select-${resetKey}`}
                        onChange={setSelectedStatuses}
                        defaultValue={selectedStatuses || []}
                        triggerClassName={
                            selectedStatuses &&
                            'text-default-800 bg-default-100 border border-default-300'
                        }
                    />
                )}
                <PrioritySelect
                    key={`priority-select-${resetKey}`}
                    onChange={setSelectedPriority}
                    defaultValue={selectedPriority}
                    triggerClassName={
                        selectedPriority &&
                        'text-default-800 bg-default-100 border border-default-300'
                    }
                />
                <UserSelect
                    defaultToCurrentUser
                    multiSelect
                    onChange={setSelectedAssignees}
                    defaultToAllUsers={defaultToAllUsers}
                />
                {hasActiveFilters && (
                    <Button
                        size="sm"
                        color="primary"
                        variant="light"
                        onPress={clearFilters}
                        startContent={<RiFilterOffLine fontSize="1rem" />}
                        className="font-medium"
                    >
                        Clear filters
                    </Button>
                )}
            </div>
        </div>
    );
}

export default TasksFilters;
