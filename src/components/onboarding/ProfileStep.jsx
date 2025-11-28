import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input } from '@heroui/react';
import { useUser } from '../../hooks/react-query/user/useUser'; // Assuming this hook exists
import toast from 'react-hot-toast';
import AvatarUploader from '../user/AvatarUploader.jsx';
import {
    useUserProfile,
    useUpdateUserProfile,
} from '../../hooks/react-query/user/useUserProfile.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';

function ProfileStep({ goToNextStep }) {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: userProfile } = useUserProfile(user);
    const { mutateAsync: updateUserProfile } = useUpdateUserProfile(user, currentWorkspace);
    const [isPending, setIsPending] = useState(false);

    // Initialize react-hook-form
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitSuccessful },
        reset,
    } = useForm({
        defaultValues: {
            name: '',
        },
    });

    // Function to handle the profile update logic
    const handleUpdateProfile = async (formData) => {
        setIsPending(true);
        try {
            const updateData = {
                name: formData.name,
                onboarded: true,
            };

            await updateUserProfile(updateData);
            toast.success('Profile updated successfully!');

            goToNextStep();
        } catch (error) {
            console.error(error);
            const errorMessage = error.response
                ? (await error.response.json()).error
                : error.message;
            toast.error(errorMessage || 'Failed to update profile. Please try again.');
        } finally {
            setIsPending(false);
        }
    };

    useEffect(() => {
        if (userProfile?.name) {
            reset({
                name: userProfile.name,
            });
        }
    }, [reset, userProfile]);

    return (
        <form
            onSubmit={handleSubmit(handleUpdateProfile)}
            className="flex flex-col gap-6 mt-8 text-left"
        >
            {/* Avatar Section */}
            <AvatarUploader />

            {/* Name Input Section */}
            <h4 className="text-lg font-medium">Cual es tu nombre?</h4>
            <Controller
                name="name"
                control={control}
                rules={{ required: 'Este campo es obligatorio' }}
                render={({ field }) => (
                    <Input
                        {...field}
                        label="Nombre"
                        isInvalid={!!errors.name}
                        errorMessage={errors.name?.message}
                        variant="faded"
                    />
                )}
            />

            {/* Submission Button */}
            <Button
                color="primary"
                type="submit"
                isLoading={isPending}
                disabled={isSubmitSuccessful}
                fullWidth
            >
                {isSubmitSuccessful ? 'Saved!' : 'Continue'}
            </Button>
        </form>
    );
}

export default ProfileStep;
