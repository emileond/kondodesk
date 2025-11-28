import { useState, useCallback } from 'react';
import { Avatar, Button, Spinner } from '@heroui/react';
import toast from 'react-hot-toast';
import ky from 'ky';
import { useUser } from '../../hooks/react-query/user/useUser.js';
import { useUserProfile } from '../../hooks/react-query/user/useUserProfile.js';
import { useUpdateUserProfile } from '../../hooks/react-query/user/useUserProfile.js';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import BoringAvatar from 'boring-avatars';

const AvatarUploader = () => {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: userProfile } = useUserProfile(user);
    const { mutateAsync: updateUserProfile } = useUpdateUserProfile(user, currentWorkspace);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = useCallback(
        async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Validate file type
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                return toast.error('Invalid file type. Please upload PNG or JPG.');
            }

            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                return toast.error('File size exceeds 10MB. Please choose a smaller image.');
            }

            setUploading(true);

            try {
                // Create form data for the API request
                const formData = new FormData();
                formData.append('file', file);
                formData.append('userEmail', user.email);

                // Upload to Cloudflare Images via our API route
                const response = await ky
                    .post('/api/avatar', {
                        body: formData,
                        timeout: 30000, // 30 seconds timeout
                    })
                    .json();

                if (!response.success)
                    throw new Error(response.error || 'Failed to upload avatar.');

                // Update user profile with the new avatar URL
                await updateUserProfile({
                    avatar: `https://imagedelivery.net/6dk6421L53E1LLAitvCWCQ/${response.imageId}`,
                });
                toast.success('Avatar updated successfully!');
            } catch (error) {
                console.error(error);
                toast.error(error.message);
            } finally {
                setUploading(false);
            }
        },
        [user, updateUserProfile],
    );

    if (!userProfile) return null; // Prevents rendering when data isn't ready

    const avatarUrl = userProfile?.avatar ? `${userProfile?.avatar}/w=128` : null;

    return (
        <div className="flex flex-col items-center gap-6">
            {avatarUrl ? (
                <Avatar alt="User avatar" showFallback className="w-32 h-32" src={avatarUrl} />
            ) : (
                <BoringAvatar
                    name={userProfile?.name || userProfile?.email}
                    size={128}
                    variant="beam"
                    colors={['#fbbf24', '#735587', '#5bc0be', '#6366f1']}
                />
            )}

            <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                hidden
                id="avatar-upload"
                onChange={handleFileChange}
            />
            <label htmlFor="avatar-upload">
                <Button size="sm" as="span" variant="bordered" color="primary" disabled={uploading}>
                    {uploading ? <Spinner size="sm" /> : 'Cambiar avatar'}
                </Button>
            </label>
        </div>
    );
};

export default AvatarUploader;
