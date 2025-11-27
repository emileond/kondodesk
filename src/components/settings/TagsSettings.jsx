import { useState, useEffect } from 'react';
import {
    useTags,
    useUpdateTag,
    useDeleteTag,
    useCreateTag,
} from '../../hooks/react-query/tags/useTags';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import {
    Input,
    Button,
    Spinner,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from '@heroui/react';
import ColorPicker from '../form/ColorPicker';
import toast from 'react-hot-toast';
import { RiMore2Fill, RiPencilLine, RiDeleteBinLine, RiAddLine } from 'react-icons/ri';

/**
 * A reusable modal for creating or editing a tag.
 * If a `tag` prop is provided, it operates in "edit" mode.
 * Otherwise, it operates in "create" mode.
 */
const TagModal = ({ isOpen, onOpenChange, tag }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const [name, setName] = useState('');
    const [color, setColor] = useState('#cccccc');

    const { mutate: createTag, isPending: isCreating } = useCreateTag(currentWorkspace);
    const { mutate: updateTag, isPending: isUpdating } = useUpdateTag(currentWorkspace);

    const isEditMode = !!tag;

    useEffect(() => {
        if (isEditMode && tag) {
            setName(tag.name);
            setColor(tag.color || '#cccccc');
        } else {
            // Reset for "create" mode
            setName('');
            setColor('#cccccc');
        }
    }, [tag, isEditMode, isOpen]);

    const handleSave = () => {
        if (!name) {
            toast.error("Tag name can't be empty.");
            return;
        }

        if (isEditMode) {
            updateTag(
                { tagId: tag.id, updates: { name, color } },
                {
                    onSuccess: () => {
                        toast.success(`Tag "${name}" updated.`);
                        onOpenChange(false);
                    },
                    onError: (err) => toast.error(err.message),
                },
            );
        } else {
            createTag(
                { tag: { name, color, workspace_id: currentWorkspace.workspace_id } },
                {
                    onSuccess: () => {
                        toast.success(`Tag "${name}" created.`);
                        onOpenChange(false);
                    },
                    onError: (err) => toast.error(err.message),
                },
            );
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>{isEditMode ? 'Edit tag' : 'Create new tag'}</ModalHeader>
                        <ModalBody>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-sm text-default-600 mb-1 block">
                                        Tag name
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        variant="bordered"
                                        placeholder="e.g. Urgent"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-default-600 mb-1 block">
                                        Tag color
                                    </label>
                                    <ColorPicker value={color} onChange={setColor} />
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="ghost" color="default" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                isLoading={isCreating || isUpdating}
                                onPress={handleSave}
                            >
                                {isEditMode ? 'Save changes' : 'Create tag'}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

/**
 * A confirmation modal for deleting a tag.
 */
const DeleteConfirmationModal = ({ isOpen, onOpenChange, onConfirm, tag }) => {
    const { isPending: isDeleting } = useDeleteTag();
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>Delete Tag</ModalHeader>
                        <ModalBody>
                            <p>
                                Are you sure you want to delete the tag "{tag?.name}"? This action
                                cannot be undone.
                            </p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="ghost" color="default" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button color="danger" isLoading={isDeleting} onPress={onConfirm}>
                                Delete
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

/**
 * A display row for a single tag, with edit and delete actions in a dropdown.
 */
const TagDisplayRow = ({ tag, onEdit, onDelete }) => {
    return (
        <div className="flex items-center gap-2 p-2 border-b border-default-100 last:border-b-0">
            <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color || '#cccccc' }}
            />
            <p className="grow font-medium text-default-foreground">{tag.name}</p>
            <Dropdown>
                <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light">
                        <RiMore2Fill fontSize="1.1rem" className="text-default-500" />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Tag Actions">
                    <DropdownItem
                        key="edit"
                        startContent={<RiPencilLine />}
                        onPress={() => onEdit(tag)}
                    >
                        Edit
                    </DropdownItem>
                    <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        startContent={<RiDeleteBinLine />}
                        onPress={() => onDelete(tag)}
                    >
                        Delete
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </div>
    );
};

/**
 * Main component to manage all tags in a workspace.
 */
const TagsSettings = () => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: tags, isLoading } = useTags(currentWorkspace);

    // State for the create/edit modal
    const {
        isOpen: isTagModalOpen,
        onOpen: onTagModalOpen,
        onOpenChange: onTagModalOpenChange,
    } = useDisclosure();
    const [selectedTag, setSelectedTag] = useState(null);

    // State for the delete confirmation modal
    const {
        isOpen: isDeleteModalOpen,
        onOpen: onDeleteModalOpen,
        onOpenChange: onDeleteModalOpenChange,
    } = useDisclosure();
    const [tagToDelete, setTagToDelete] = useState(null);
    const { mutate: deleteTag } = useDeleteTag(currentWorkspace);

    const handleCreateClick = () => {
        setSelectedTag(null); // Ensure we are in "create" mode
        onTagModalOpen();
    };

    const handleEditClick = (tag) => {
        setSelectedTag(tag);
        onTagModalOpen();
    };

    const handleDeleteClick = (tag) => {
        setTagToDelete(tag);
        onDeleteModalOpen();
    };

    const confirmDelete = () => {
        if (!tagToDelete) return;
        deleteTag(
            { tagId: tagToDelete.id },
            {
                onSuccess: () => {
                    toast.success(`Tag "${tagToDelete.name}" deleted.`);
                    onDeleteModalOpenChange(false);
                },
                onError: (err) => toast.error(err.message),
            },
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-24">
                <Spinner />
            </div>
        );
    }

    return (
        <>
            <div className="flex gap-2 items-center mb-3">
                <h4 className="font-medium">Tags</h4>
                <Button
                    size="sm"
                    color="primary"
                    variant="light"
                    startContent={<RiAddLine fontSize="1rem" />}
                    onPress={handleCreateClick}
                >
                    New tag
                </Button>
            </div>
            <div className="flex flex-col max-h-96 overflow-y-auto p-2">
                {tags && tags.length > 0 ? (
                    tags.map((tag) => (
                        <TagDisplayRow
                            key={tag.id}
                            tag={tag}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                        />
                    ))
                ) : (
                    <p className="text-sm text-default-500 text-center p-4">No tags created yet.</p>
                )}
            </div>

            <TagModal
                isOpen={isTagModalOpen}
                onOpenChange={onTagModalOpenChange}
                tag={selectedTag}
            />

            {tagToDelete && (
                <DeleteConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onOpenChange={onDeleteModalOpenChange}
                    tag={tagToDelete}
                    onConfirm={confirmDelete}
                />
            )}
        </>
    );
};

export default TagsSettings;
