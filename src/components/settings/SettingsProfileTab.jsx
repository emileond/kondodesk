import { Button, Card, CardBody, CardFooter, Input, Divider } from '@heroui/react';
import AvatarUploader from '../user/AvatarUploader.jsx';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import {
    useUpdateUserProfile,
    useUserProfile,
} from '../../hooks/react-query/user/useUserProfile.js';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import { supabaseClient } from '../../lib/supabase.js';

const SettingsProfileTab = () => {
    const { data: user } = useUser();
    const { data: userProfile } = useUserProfile(user);
    const { mutateAsync: updateUserProfile, isPending } = useUpdateUserProfile(user);

    // Form setup with react-hook-form
    const {
        control,
        handleSubmit,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: { name: '' },
    });
    const {
        control: passwordControl,
        handleSubmit: handlePasswordSubmit,
        watch,
        reset: resetPasswordForm,
        formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    } = useForm({
        defaultValues: { password: '', confirmPassword: '' },
    });
    const newPassword = watch('password');

    const onSubmit = async (data) => {
        try {
            await updateUserProfile({ name: data.name });
            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update profile.');
        }
    };

    const onPasswordSubmit = async (data) => {
        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: data.password,
            });
            if (error) throw error;

            toast.success('Contraseña actualizada');
            resetPasswordForm({ password: '', confirmPassword: '' });
        } catch (error) {
            toast.error(error?.message || 'No se pudo actualizar la contraseña');
        }
    };

    useEffect(() => {
        if (userProfile?.name) {
            setValue('name', userProfile.name);
        }
    }, [userProfile, setValue]);

    const handleReset = () => {
        reset({ name: userProfile?.name || '' });
    };

    return (
        <div className="flex flex-col gap-6">
            <Card shadow="sm">
                <CardBody className="flex flex-col gap-6 p-4">
                    <h4>Avatar</h4>
                    <AvatarUploader />

                    <h4>Name</h4>
                    <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="max-w-sm">
                        <Controller
                            name="name"
                            control={control}
                            rules={{ required: 'Name is required' }}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Name"
                                    isInvalid={!!errors.name}
                                    errorMessage={errors.name?.message}
                                />
                            )}
                        />
                    </form>
                </CardBody>
                <Divider />
                <CardFooter className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        color="default"
                        size="sm"
                        onClick={handleReset}
                        isDisabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="profile-form"
                        color="primary"
                        size="sm"
                        isLoading={isSubmitting}
                        disabled={isPending}
                    >
                        Save
                    </Button>
                </CardFooter>
            </Card>

            <Card shadow="sm">
                <CardBody className="flex flex-col gap-4 p-4">
                    <h4>Cambiar contraseña</h4>
                    <form
                        id="change-password-form"
                        onSubmit={handlePasswordSubmit(onPasswordSubmit)}
                        className="max-w-sm flex flex-col gap-3"
                    >
                        <Controller
                            name="password"
                            control={passwordControl}
                            rules={{
                                required: 'Nueva contraseña requerida',
                                minLength: {
                                    value: 6,
                                    message: 'Debe tener al menos 6 caracteres',
                                },
                            }}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="password"
                                    label="Nueva contraseña"
                                    isInvalid={!!passwordErrors.password}
                                    errorMessage={passwordErrors.password?.message}
                                />
                            )}
                        />
                        <Controller
                            name="confirmPassword"
                            control={passwordControl}
                            rules={{
                                required: 'Confirma tu contraseña',
                                validate: (value) =>
                                    value === newPassword || 'Las contraseñas no coinciden',
                            }}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="password"
                                    label="Confirmar contraseña"
                                    isInvalid={!!passwordErrors.confirmPassword}
                                    errorMessage={passwordErrors.confirmPassword?.message}
                                />
                            )}
                        />
                    </form>
                </CardBody>
                <Divider />
                <CardFooter className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        color="default"
                        size="sm"
                        onClick={() => resetPasswordForm({ password: '', confirmPassword: '' })}
                        isDisabled={isPasswordSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="change-password-form"
                        color="primary"
                        size="sm"
                        isLoading={isPasswordSubmitting}
                    >
                        Actualizar contraseña
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default SettingsProfileTab;
