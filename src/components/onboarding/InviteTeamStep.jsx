import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, SelectItem } from '@heroui/react';
import { useUser } from '../../hooks/react-query/user/useUser';
import { useAddWorkspaceMember } from '../../hooks/react-query/condos/useWorkspaceMembers';
import { validateEmail } from '../../utils/validateEmail.js';
import toast from 'react-hot-toast';

function InviteTeamStep({ currentWorkspace, goToNextStep }) {
    const { data: user } = useUser();
    const [isCompleted, setIsCompleted] = useState(false);
    const { mutateAsync: addWorkspaceMember, isPending: isAddPending } =
        useAddWorkspaceMember(currentWorkspace);

    // Initialize react-hook-form for the invite form
    const { register: registerInvite, handleSubmit: handleInviteSubmit } = useForm();

    // Function to handle sending invites
    const handleSendInvites = async (inviteData) => {
        const invites = Object.values(inviteData);
        const results = { success: 0, failed: 0 };
        const errors = [];

        for (const invite of invites.filter((inv) => inv.email && inv.role)) {
            const result = await validateEmail(invite.email);
            if (!result.syntax_error) {
                await addWorkspaceMember(
                    {
                        invite_email: invite.email,
                        role: invite.role,
                        workspace_id: currentWorkspace.workspace_id,
                        invited_by: user.email,
                    },
                    {
                        onSuccess: () => {
                            results.success++;
                        },
                        onError: (error) => {
                            results.failed++;
                            errors.push(`${invite.email}: ${error?.message}`);
                        },
                    },
                );
            }
        }

        // Show summary toast
        if (results.success > 0) {
            toast.success(`Successfully invited ${results.success} team member(s)`);
            setIsCompleted(true);
            goToNextStep();
        }
        if (results.failed > 0) {
            toast.error(`Failed to invite ${results.failed} team member(s)`);
            console.error('Invite errors:', errors);
        }
    };

    // Function to skip inviting team members
    const handleSkip = () => {
        setIsCompleted(true);
        toast.success('Skipped team invitations');
        goToNextStep();
    };

    return (
        <div>
            <p className="mb-3">
                Invite your team members to collaborate. You can always add more later!
            </p>
            <form
                onSubmit={handleInviteSubmit(handleSendInvites)}
                className="flex flex-col gap-3 py-6"
            >
                {Array.from({ length: 3 }).map((_, index) => (
                    <div className="flex gap-3" key={index}>
                        <Input
                            label="Email"
                            type="email"
                            fullWidth
                            {...registerInvite(`${index}.email`, {
                                validate: {
                                    format: async (value) => {
                                        if (!value) return true; // Allow empty fields
                                        const result = await validateEmail(value);
                                        return !result.syntax_error || 'Invalid email format';
                                    },
                                    duplicate: (value, formValues) => {
                                        if (!value) return true;
                                        const emails = Object.values(formValues)
                                            .filter((v) => v?.email)
                                            .map((v) => v.email);
                                        return (
                                            emails.filter((e) => e === value).length === 1 ||
                                            'Duplicate email address'
                                        );
                                    },
                                },
                            })}
                            className="basis-4/3"
                            disabled={isCompleted}
                        />
                        <Select
                            variant="bordered"
                            label="Role"
                            placeholder="Select a role"
                            className="basis-1/3"
                            defaultSelectedKeys={['member']}
                            {...registerInvite(`${index}.role`, {})}
                            disabled={isCompleted}
                        >
                            <SelectItem key="admin">Admin</SelectItem>
                            <SelectItem key="member">Member</SelectItem>
                        </Select>
                    </div>
                ))}
                <div className="flex flex-col justify-end gap-3 mt-6">
                    <Button
                        color="primary"
                        type="submit"
                        isLoading={isAddPending}
                        disabled={isCompleted}
                    >
                        {isCompleted ? 'Invites Sent' : 'Send Invites'}
                    </Button>
                    <Button
                        variant="light"
                        color="primary"
                        onPress={handleSkip}
                        disabled={isCompleted}
                    >
                        Skip for now
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default InviteTeamStep;
