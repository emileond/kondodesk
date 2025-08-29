import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
    Button,
    RadioGroup,
    Radio,
    Switch,
    CardHeader,
    Card,
    CardBody,
    Divider,
    CardFooter,
} from '@heroui/react';
import { supabaseClient } from '../../lib/supabase';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import { useUser } from '../../hooks/react-query/user/useUser';
import { useUserProfile } from '../../hooks/react-query/user/useUserProfile.js';
import toast from 'react-hot-toast';
import { useUpdateUserProfile } from '../../hooks/react-query/user/useUserProfile.js';

// Helper objects to map UI-friendly selections to backend-friendly data
const dayStringToNumber = {
    friday: 5,
    saturday: 6,
    sunday: 0,
    monday: 1,
};

const dayNumberToString = {
    5: 'friday',
    6: 'saturday',
    0: 'sunday',
    1: 'monday',
};

function SettingsRemindersTab() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: user } = useUser();
    const { data: userProfile } = useUserProfile(user);
    const { mutateAsync: updateUserProfile } = useUpdateUserProfile(user, currentWorkspace);
    const [isPending, setIsPending] = useState(false);

    const {
        control,
        handleSubmit,
        reset, // Add reset from useForm
        watch,
    } = useForm();

    useEffect(() => {
        // Only reset the form if userProfile data exists
        if (userProfile) {
            reset({
                planningDay: dayNumberToString[userProfile.planning_day_of_week] ?? 'monday',
                enableReminders: !!userProfile.planning_reminder,
            });
        }
    }, [userProfile, reset]); // Add userProfile and reset as dependencies

    const handleSaveRoutine = async (formData) => {
        setIsPending(true);
        try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) throw new Error('You must be logged in to save settings.');

            // 1. Get the user's timezone from their browser
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // 2. Prepare the robust data payload for your backend
            const updateData = {
                planning_reminder: formData.enableReminders,
                planning_day_of_week: formData.enableReminders
                    ? dayStringToNumber[formData.planningDay]
                    : null,
                timezone: timezone,
            };

            // 3. Save data
            await updateUserProfile(updateData);
            toast.success('Your planning routine has been saved!');
        } catch (error) {
            console.error(error);
            const errorMessage = error.response
                ? (await error.response.json()).error
                : error.message;
            toast.error(errorMessage || 'Failed to save your routine. Please try again.');
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Card shadow="sm">
            <CardHeader>
                <h4 className="font-medium">Reminders</h4>
            </CardHeader>
            <CardBody>
                <form
                    id="planning-reminders"
                    onSubmit={handleSubmit(handleSaveRoutine)}
                    className="flex flex-col gap-8"
                >
                    {/* Reminder Toggle */}
                    <Controller
                        name="enableReminders"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                            <Switch size="sm" isSelected={value} onValueChange={onChange}>
                                Planning reminders
                            </Switch>
                        )}
                    />

                    {/* Day Selection */}
                    {watch('enableReminders') && (
                        <Controller
                            name="planningDay"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup {...field} className="gap-2" label="Remind me on">
                                    <Radio value="friday">Fridays</Radio>
                                    <Radio value="saturday">Saturdays</Radio>
                                    <Radio value="sunday">Sundays</Radio>
                                    <Radio value="monday">Mondays</Radio>
                                </RadioGroup>
                            )}
                        />
                    )}
                </form>
            </CardBody>
            <Divider />
            <CardFooter>
                <div className="w-full flex gap-2 justify-end">
                    <Button
                        size="sm"
                        variant="ghost"
                        color="default"
                        isDisabled={isPending}
                        onPress={() => reset()}
                    >
                        Cancel
                    </Button>
                    <Button
                        form="planning-reminders"
                        size="sm"
                        color="primary"
                        type="submit"
                        isLoading={isPending}
                    >
                        Save
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}

export default SettingsRemindersTab;
