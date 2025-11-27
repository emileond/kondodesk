import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Divider,
    Input,
    Tooltip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from '@heroui/react';
import BlockEditor from '../editor/BlockEditor.jsx';
import { useState, useRef, useEffect } from 'react';
import { RiEdit2Line, RiPushpinLine, RiDeleteBinLine, RiPushpinFill } from 'react-icons/ri';
import { useUpdateNote, useDeleteNote } from '../../hooks/react-query/notes/useNotes';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import toast from 'react-hot-toast';
import { toUTC, formatDate } from '../../utils/dateUtils';

// Extend dayjs with calendar plugin
dayjs.extend(calendar);

const NoteCard = ({ note, currentWorkspace }) => {
    const [isEditable, setIsEditable] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasOverflow, setHasOverflow] = useState(false);
    const [editedNote, setEditedNote] = useState({
        title: note.title,
        content: note.content,
    });

    // Delete confirmation modal
    const { isOpen, onOpen, onClose } = useDisclosure();

    // Hooks for note operations
    const updateNote = useUpdateNote(currentWorkspace);
    const deleteNote = useDeleteNote(currentWorkspace);

    const contentRef = useRef(null);

    // Handle card click to expand/collapse
    const handleCardClick = () => {
        if (hasOverflow && !isEditable) {
            setIsExpanded(!isExpanded);
        }
    };

    const handleEdit = () => {
        // Reset editedNote to current note values when entering edit mode
        setEditedNote({
            title: note.title,
            content: note.content,
        });
        setIsEditable(true);
        setIsExpanded(true);
    };

    const handleTitleChange = (e) => {
        setEditedNote((prev) => ({ ...prev, title: e.target.value }));
    };

    const handleContentChange = (newContent) => {
        setEditedNote((prev) => ({ ...prev, content: newContent }));
    };

    const handleSave = () => {
        updateNote.mutate(
            {
                noteId: note.id,
                updates: {
                    title: editedNote.title,
                    content: editedNote.content,
                    updated_at: toUTC(), // Add updated_at field with current UTC timestamp
                },
            },
            {
                onSuccess: () => {
                    // Update the note object to reflect changes immediately
                    note.title = editedNote.title;
                    note.content = editedNote.content;
                    note.updated_at = toUTC();

                    toast.success('Note updated successfully!');
                    setIsEditable(false);
                },
                onError: (error) => {
                    toast.error('Failed to update note: ' + error.message);
                },
            },
        );
    };

    // Handle delete confirmation
    const handleDeleteConfirm = () => {
        deleteNote.mutate(
            { noteId: note.id },
            {
                onSuccess: () => toast('Note deleted'),
                onError: (error) => toast.error('Failed to delete note: ' + error.message),
            },
        );
        onClose();
    };

    // Check if content overflows
    useEffect(() => {
        const checkOverflow = () => {
            if (contentRef.current) {
                const hasContentOverflow =
                    contentRef.current.scrollHeight > contentRef.current.clientHeight;
                setHasOverflow(hasContentOverflow);
            }
        };

        // Initial check
        checkOverflow();

        // Add resize listener to recheck on window resize
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [note.content]);

    return (
        <>
            <Card
                shadow={isEditable ? 'md' : 'none'}
                className={`border border-default-200 transition-height duration-300 ease-in-out`}
            >
                <CardHeader className="pb-0">
                    <Input
                        size="lg"
                        placeholder="Untitled note"
                        variant="bordered"
                        value={isEditable ? editedNote.title : note.title}
                        classNames={{
                            inputWrapper: 'shadow-none border-0',
                            input: 'text-xl font-semibold',
                        }}
                        isReadOnly={!isEditable}
                        onChange={handleTitleChange}
                    />
                    {!isEditable && (
                        <div className="flex">
                            <Tooltip content={note.is_pinned ? 'Unpin' : 'Pin'}>
                                <Button
                                    variant="light"
                                    size="sm"
                                    isIconOnly
                                    onPress={() => {
                                        updateNote.mutate({
                                            noteId: note.id,
                                            updates: { is_pinned: !note.is_pinned },
                                        });
                                    }}
                                    className={`${note.is_pinned ? 'text-orange-500' : 'text-default-600 hover:text-default-700'}`}
                                >
                                    {note.is_pinned ? (
                                        <RiPushpinFill fontSize="1rem" />
                                    ) : (
                                        <RiPushpinLine fontSize="1rem" />
                                    )}
                                </Button>
                            </Tooltip>
                            <Tooltip content="Edit">
                                <Button
                                    variant="light"
                                    size="sm"
                                    isIconOnly
                                    onPress={handleEdit}
                                    className="text-default-600 hover:text-default-700"
                                >
                                    <RiEdit2Line fontSize="1rem" />
                                </Button>
                            </Tooltip>
                            <Tooltip content="Delete">
                                <Button
                                    variant="light"
                                    color="danger"
                                    size="sm"
                                    isIconOnly
                                    onPress={onOpen}
                                >
                                    <RiDeleteBinLine fontSize="1rem" />
                                </Button>
                            </Tooltip>
                        </div>
                    )}
                </CardHeader>
                <CardBody
                    className={`p-6 pt-0 overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? 'max-h-[2000px]' : 'max-h-80 '
                    }`}
                    ref={contentRef}
                >
                    {hasOverflow && !isEditable && (
                        <div
                            className="flex items-center justify-center absolute bottom-0 left-0 z-10 w-full text-sm text-center text-default-600 bg-content1 hover:bg-content2 h-8 cursor-pointer transition-opacity duration-300 ease-in-out"
                            onClick={handleCardClick}
                        >
                            {isExpanded ? 'See less' : 'See more'}
                        </div>
                    )}
                    <div key={isEditable ? 'edit' : 'read'}>
                        <BlockEditor
                            isEditable={isEditable}
                            defaultContent={note.content}
                            onChange={handleContentChange}
                            placeholder="Start writing your notes here..."
                        />
                    </div>
                </CardBody>
                <Divider />
                <CardFooter className="flex justify-between">
                    {isEditable ? (
                        <>
                            <Button
                                variant="light"
                                size="sm"
                                onPress={() => {
                                    // Reset to original state and exit edit mode
                                    setEditedNote({
                                        title: note.title,
                                        content: note.content,
                                    });
                                    setIsEditable(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                color="primary"
                                onPress={handleSave}
                                isLoading={updateNote.isPending}
                            >
                                Save
                            </Button>
                        </>
                    ) : (
                        <p className="text-sm text-default-600 py-2">
                            {formatDate(note.updated_at, { dateStyle: 'long' })}
                        </p>
                    )}
                </CardFooter>
            </Card>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">Delete Note</ModalHeader>
                    <ModalBody>
                        <p>Are you sure you want to delete this note?</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            Cancel
                        </Button>
                        <Button color="danger" onPress={handleDeleteConfirm}>
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default NoteCard;
