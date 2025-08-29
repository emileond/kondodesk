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

    // Handle form submission
    const onSubmit = async (data) => {
        try {
            await updateUserProfile({ name: data.name });
            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update profile.');
        }
    };

    // Reset form when `userProfile` loads
    useEffect(() => {
        if (userProfile?.name) {
            setValue('name', userProfile.name);
        }
    }, [userProfile, setValue]);

    // Handle resetting the form
    const handleReset = () => {
        reset({ name: userProfile?.name || '' });
    };

    return (
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
    );
};

export default SettingsProfileTab;
