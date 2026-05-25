import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, Input, Spinner } from '@heroui/react';
import { useForm } from 'react-hook-form';
import ky from 'ky';
import toast from 'react-hot-toast';
import { supabaseClient } from '../../lib/supabase';

const api = ky.create({ prefixUrl: '/api' });

function AcceptInvitePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const invitationToken = searchParams.get('invitation_token');
    const [isLoadingInvite, setIsLoadingInvite] = useState(!!invitationToken);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [invitation, setInvitation] = useState(null);
    const [inviteError, setInviteError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm();

    useEffect(() => {
        if (!invitationToken) {
            return;
        }

        const loadInvitation = async () => {
            try {
                const res = await api
                    .get(
                        `team/invitations/accept?invitation_token=${encodeURIComponent(
                            invitationToken,
                        )}`,
                    )
                    .json();
                if (!res?.success) {
                    throw new Error(res?.error || 'Invalid invitation');
                }
                setInvitation(res.data);
            } catch (error) {
                setInviteError(error?.message || 'Invalid invitation');
            } finally {
                setIsLoadingInvite(false);
            }
        };

        loadInvitation();
    }, [invitationToken]);

    const onSubmit = async ({ password }) => {
        if (!invitationToken) return;
        setIsSubmitting(true);
        try {
            const res = await api
                .post('team/invitations/accept', {
                    json: {
                        invitation_token: invitationToken,
                        password,
                    },
                })
                .json();
            if (!res?.success) {
                throw new Error(res?.error || 'Could not accept invitation');
            }

            const { error: signInError } = await supabaseClient.auth.signInWithPassword({
                email: invitation?.email,
                password,
            });
            if (signInError) {
                throw new Error(signInError.message);
            }

            toast.success('Account ready. Welcome to your condo!');
            navigate('/home');
        } catch (error) {
            toast.error(error?.message || 'Could not finish account setup');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingInvite) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <Spinner />
                    <span>Loading invitation...</span>
                </div>
            </div>
        );
    }

    if (!invitationToken || !invitation || inviteError) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardHeader className="text-lg font-semibold">Invalid invitation</CardHeader>
                    <CardBody>
                        <p className="text-default-600">
                            {inviteError ||
                                (invitationToken
                                    ? 'This invitation is invalid or expired.'
                                    : 'Invitation token is missing.')}
                        </p>
                        <Button className="mt-4" color="primary" onPress={() => navigate('/login')}>
                            Go to login
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4">
            <Card className="w-full max-w-xl">
                <CardHeader className="text-lg font-semibold">Set your password</CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <p className="text-sm text-default-600">
                        You are joining <strong>{invitation?.condo_name || 'your condo'}</strong> as{' '}
                        <strong>{invitation?.role}</strong> with <strong>{invitation?.email}</strong>.
                    </p>

                    <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
                        <Input
                            type="password"
                            label="Password"
                            {...register('password', {
                                required: 'Password is required',
                                minLength: {
                                    value: 8,
                                    message: 'Password must be at least 8 characters',
                                },
                            })}
                            isInvalid={!!errors.password}
                            errorMessage={errors.password?.message}
                        />
                        <Input
                            type="password"
                            label="Confirm password"
                            {...register('confirm_password', {
                                required: 'Confirm password is required',
                                validate: (value, formValues) =>
                                    value === formValues?.password || 'Passwords do not match',
                            })}
                            isInvalid={!!errors.confirm_password}
                            errorMessage={errors.confirm_password?.message}
                        />
                        <Button color="primary" type="submit" isLoading={isSubmitting}>
                            Create account
                        </Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}

export default AcceptInvitePage;
