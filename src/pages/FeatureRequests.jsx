import NavBar from '../components/marketing/Nav';
import {
    Button,
    Input,
    Textarea,
    Select,
    SelectItem,
    Chip,
    Divider,
    Modal,
    ModalContent,
    ModalBody,
    useDisclosure,
    Spinner,
} from '@heroui/react';
import Footer from '../components/marketing/Footer.jsx';
import { RiCircleFill } from 'react-icons/ri';
import {
    useFeatureRequests,
    useSearchFeatureRequests,
} from '../hooks/react-query/feature-requests/useFeatureRequests.js';
import { useCreateFeatureRequest } from '../hooks/react-query/feature-requests/useFeatureRequests.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import AuthForm from '../components/auth/AuthForm.jsx';
import FeatureRequestCard from '../components/roadmap/FeatureRequestCard.jsx';

function FeatureRequestsPage() {
    const [status, setStatus] = useState('idea');
    const { data: user } = useUser();
    const { mutateAsync: createFeatureRequest, isPending } = useCreateFeatureRequest(user);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm();

    // Watch the title input for changes
    const titleValue = useWatch({
        control,
        name: 'title',
        defaultValue: '',
    });

    const { data: statusItems, isPending: statusItemsPending } = useFeatureRequests(user, [status]);
    const { data: searchedItems, isPending: searchPending } = useSearchFeatureRequests(titleValue);

    // Determine which list to display
    const isSearching = titleValue?.trim() !== '';
    const displayedItems = isSearching ? searchedItems : statusItems;
    const itemsPending = isSearching ? searchPending : statusItemsPending;

    const onSubmit = async (data) => {
        if (!user) {
            onOpen();
            return;
        }

        try {
            await createFeatureRequest({
                title: data.title,
                description: data.description,
                user_id: user.id,
            });
            reset();
            toast('Idea submitted', {
                type: 'success',
                icon: '✅',
            });
        } catch (e) {
            console.log(e);
            toast('Failed to submit idea', {
                type: 'error',
                icon: '❌',
            });
        }
    };

    const statusList = [
        { key: 'idea', color: 'text-default-400' },
        { key: 'planned', color: 'text-primary-400' },
        { key: 'in progress', color: 'text-blue-400' },
        { key: 'done', color: 'text-success-400' },
    ];

    return (
        <div className="w-screen min-h-screen bg-content2/50">
            <NavBar />
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    <ModalBody>
                        <AuthForm hideLogo onSuccess={() => onOpenChange()} />
                    </ModalBody>
                </ModalContent>
            </Modal>
            <div className="container mx-auto max-w-[1280px] px-6 py-16">
                <h1 className="text-left text-4xl font-bold pt-12 pb-6">Suggest a feature</h1>
                <p className="font-medium">
                    Tell us what you’d like to see on {import.meta.env.VITE_APP_NAME}
                </p>
                <div className="flex flex-wrap md:flex-nowrap gap-6 pt-12 pb-32">
                    <div className="bg-content1 p-4 rounded-xl border-1 border-content3 basis-1/3 grow h-full">
                        <div className="space-y-2">
                            <h2 className={`text-lg font-semibold`}>Add your idea</h2>
                            <p className="text-default-600">
                                This could be a problem you&apos;re having or something you wish was
                                possible with {import.meta.env.VITE_APP_NAME}
                            </p>
                        </div>
                        <form
                            id="submit-idea"
                            onSubmit={handleSubmit(onSubmit)}
                            className="mt-14 space-y-6"
                        >
                            <Input
                                {...register('title', { required: 'Required field' })}
                                label="Title"
                                labelPlacement="outside"
                                placeholder="Keep it short"
                                isClearable
                                onClear={() => reset({ title: '' })}
                                isInvalid={!!errors?.title}
                                errorMessage={errors?.title?.message}
                            />
                            <Textarea
                                {...register('description', { required: 'Required field' })}
                                label="Description"
                                labelPlacement="outside"
                                placeholder="What do you need this for? Why is it important for you?"
                                isInvalid={!!errors?.description}
                                errorMessage={errors?.description?.message}
                            />
                            <Button
                                type="submit"
                                form="submit-idea"
                                color="primary"
                                className="w-full"
                                isLoading={isPending}
                            >
                                Add idea
                            </Button>
                        </form>
                    </div>
                    <div className="bg-content1 p-4 rounded-xl border-1 border-content3 basis-2/3 grow min-h-[60vh]">
                        <Select
                            selectionMode="single"
                            size="sm"
                            className="max-w-[160px]"
                            variant="bordered"
                            defaultSelectedKeys={['idea']}
                            aria-label="Status"
                            onSelectionChange={(keys) => {
                                const selectedValue = Array.from(keys)[0]; // Convert Set to Array and get the first item
                                setStatus(selectedValue);
                            }}
                            renderValue={(items) => {
                                return items.map((item) => (
                                    <Chip
                                        variant="light"
                                        key={item.key}
                                        startContent={
                                            <RiCircleFill
                                                className={
                                                    statusList.find(
                                                        (status) => status.key === item.key,
                                                    )?.color
                                                }
                                            />
                                        }
                                    >
                                        {item.key}
                                    </Chip>
                                ));
                            }}
                        >
                            {statusList.map((item) => (
                                <SelectItem
                                    key={item.key}
                                    startContent={
                                        <RiCircleFill
                                            className={
                                                statusList.find((status) => status.key === item.key)
                                                    ?.color
                                            }
                                        />
                                    }
                                >
                                    {item.key}
                                </SelectItem>
                            ))}
                        </Select>
                        <Divider className="my-3" />
                        <div className="space-y-3 h-full">
                            {itemsPending && (
                                <div className="flex justify-center items-center h-full">
                                    <Spinner size="lg" />
                                </div>
                            )}
                            {isSearching && !itemsPending && displayedItems?.length === 0 && (
                                <div className="text-center py-4 text-default-500">
                                    {`No suggestions found for "${titleValue}". Your idea is unique.`}
                                </div>
                            )}
                            {displayedItems?.map((item) => (
                                <FeatureRequestCard
                                    key={item.id}
                                    item={item}
                                    onAnonUserVote={onOpen}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default FeatureRequestsPage;
