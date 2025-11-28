import { useEffect, useMemo, useState } from 'react';
import CreatableSelect from './CreatableSelect';
import { useWorkspaceMembers } from '../../hooks/react-query/condos/useWorkspaceMembers';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { RiUserLine } from 'react-icons/ri';
import { Avatar, AvatarGroup, Spinner } from '@heroui/react';
import { useUser } from '../../hooks/react-query/user/useUser';
import BoringAvatar from 'boring-avatars';

const UserSelect = ({
    label = 'Unassigned',
    placeholder = 'Search users...',
    defaultValue = null,
    onChange,
    placement = 'bottom',
    className = '',
    triggerClassName = '',
    disabled = false,
    multiSelect = false,
    defaultToCurrentUser = false,
    defaultToAllUsers = false,
}) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: members, isLoading } = useWorkspaceMembers(currentWorkspace);
    const { data: currentUser } = useUser();
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Filter members by role and status, then map to options
    const userOptions = useMemo(() => {
        if (!members) return [];
        return members
            .filter(
                (member) =>
                    // Only include members with roles "owner", "admin", or "member"
                    ['owner', 'admin', 'member'].includes(member.role) &&
                    // Only include members with status "active"
                    member.status === 'active',
            )
            .map((member) => ({
                label: member.name || member.email,
                value: member.user_id,
                avatar: member.avatar,
                startContent: member?.avatar ? (
                    <Avatar
                        src={`${member.avatar}/w=24?t=${member?.updated_at}`}
                        className="w-6 h-6"
                    />
                ) : (
                    <BoringAvatar
                        name={member.name || member.email}
                        size={24}
                        variant="beam"
                        colors={['#fbbf24', '#735587', '#5bc0be', '#6366f1']}
                    />
                ),
            }));
    }, [members]);

    // 2. MODIFY THE useEffect to respect the new prop
    useEffect(() => {
        if (!userOptions.length || defaultValue !== null) return;

        // PRIORITY 1: Default to all users
        if (defaultToAllUsers && multiSelect) {
            // Set internal state for display (show all avatars)
            setSelectedUsers(userOptions);
            // Send the "any" string to the parent filter
            onChange('any');
        }

        // PRIORITY 2: Default to the current user (only if defaultToAllUsers is false)
        else if (defaultToCurrentUser && currentUser) {
            const currentUserOption = userOptions.find((opt) => opt.value === currentUser.id);
            if (currentUserOption) {
                const defaultVal = multiSelect ? [currentUserOption] : currentUserOption;
                const defaultId = multiSelect ? [currentUserOption.value] : currentUserOption.value;
                setSelectedUsers(defaultVal);
                onChange(defaultId);
            }
        }
    }, [
        userOptions,
        currentUser,
        defaultValue,
        onChange,
        defaultToCurrentUser,
        multiSelect,
        defaultToAllUsers,
    ]);

    return isLoading ? (
        <Spinner color="default" variant="wave" size="sm" />
    ) : (
        <CreatableSelect
            label={selectedUsers?.length > 0 ? 'user' : label}
            placeholder={placeholder}
            options={userOptions}
            // 3. MODIFY THE defaultValue prop to respect the new prop
            defaultValue={
                defaultValue
                    ? multiSelect
                        ? userOptions.filter((opt) => defaultValue.includes(opt.value))
                        : userOptions.find((opt) => opt.value === defaultValue)
                    : defaultToAllUsers && multiSelect
                      ? userOptions
                      : defaultToCurrentUser
                        ? multiSelect
                            ? userOptions.filter((opt) => opt.value === currentUser?.id)
                            : userOptions.find((opt) => opt.value === currentUser?.id)
                        : null
            }
            onChange={(value) => {
                setSelectedUsers(value);
                if (multiSelect) {
                    const val = value?.length === members?.length ? 'any' : value;
                    return onChange(val);
                }
                onChange(value);
            }}
            placement={placement}
            className={className}
            triggerClassName={triggerClassName}
            disabled={disabled}
            icon={
                selectedUsers?.length > 0 ? (
                    <AvatarGroup max={3}>
                        {Array.isArray(selectedUsers) &&
                            selectedUsers
                                .map((selected) =>
                                    userOptions.find((opt) =>
                                        typeof selected === 'object'
                                            ? opt.value === selected.value
                                            : opt.value === selected,
                                    ),
                                )
                                .filter(Boolean)
                                .map((user) => <div key={user.value}>{user.startContent}</div>)}
                    </AvatarGroup>
                ) : (
                    <RiUserLine fontSize="1rem" />
                )
            }
            multiple={multiSelect}
            allSelectedLabel={multiSelect ? 'All users' : null}
        />
    );
};

export default UserSelect;
