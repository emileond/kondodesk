import { useEffect, useMemo, useState } from 'react';
import CreatableSelect from './CreatableSelect';
import { useWorkspaceMembers } from '../../hooks/react-query/teams/useWorkspaceMembers';
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
        if (defaultToAllUsers && multiSelect && userOptions.length > 0 && defaultValue === null) {
            const allValues = userOptions.map((opt) => opt.value);
            setSelectedUsers(allValues);
            onChange(allValues);
        }

        if (
            defaultToCurrentUser &&
            userOptions.length > 0 &&
            currentUser &&
            defaultValue === null
        ) {
            const currentUserOption = userOptions.find((opt) => opt.value === currentUser.id);
            if (currentUserOption) {
                const defaultVal = multiSelect
                    ? [currentUserOption.value]
                    : currentUserOption.value;
                setSelectedUsers(defaultVal); // Only store the value(s)
                onChange(defaultVal); // Only pass value(s)
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

    // DERIVE the option object to display from the defaultValue prop
    const selectedOptionObject = useMemo(() => {
        if (defaultValue === null) return null;
        return userOptions.find((opt) => opt.value === defaultValue);
    }, [defaultValue, userOptions]);

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
