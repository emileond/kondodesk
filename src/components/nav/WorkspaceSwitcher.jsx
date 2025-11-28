import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { useWorkspaces } from '../../hooks/react-query/condos/useWorkspaces';
import { useUser } from '../../hooks/react-query/user/useUser';
import { Select, SelectItem } from '@heroui/react';
import { useEffect } from 'react';

function WorkspaceSwitcher() {
    const { data: user } = useUser();
    const { data: workspaces } = useWorkspaces(user);
    const [currentWorkspace, setCurrentWorkspace] = useCurrentWorkspace();

    useEffect(() => {
        if (workspaces && workspaces.length > 0 && user && !currentWorkspace) {
            workspaces.find((workspace) => {
                if (workspace.role === 'owner') {
                    setCurrentWorkspace(workspace);
                }
                return;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaces, user, currentWorkspace]);

    const handleChange = (e) => {
        const selectedWorkspace = workspaces.find((workspace) => workspace.id === e.target.value);
        setCurrentWorkspace(selectedWorkspace);
    };

    if (!workspaces || workspaces.length <= 1) {
        return null;
    }

    return (
        <Select
            label="Workspace"
            placeholder="Select a workspace"
            selectedKeys={[currentWorkspace?.workspace_id]}
            onChange={handleChange}
            size="sm"
            variant="bordered"
        >
            {workspaces?.map((workspace) => (
                <SelectItem
                    key={workspace.workspace_id}
                    onClick={() => setCurrentWorkspace(workspace)}
                >
                    {workspace.name}
                </SelectItem>
            ))}
        </Select>
    );
}

export default WorkspaceSwitcher;
