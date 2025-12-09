import { Button, Card, CardBody, CardFooter, CardHeader, Divider, Input } from '@heroui/react';
import BlockEditor from '../editor/BlockEditor.jsx';
import { useState } from 'react';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace.js';
import toast from 'react-hot-toast';
import { useCreateNote } from '../../hooks/react-query/notes/useNotes.js';

const NewNoteCard = ({ onCancel, onSuccess }) => {
    const [currentWorkspace] = useCurrentWorkspace();
    const [noteData, setNoteData] = useState({ title: '', content: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Create note mutation
    const createNoteMutation = useCreateNote(currentWorkspace);

    const handleTitleChange = (e) => {
        setNoteData((prev) => ({ ...prev, title: e.target.value }));
    };

    const handleContentChange = (newContent) => {
        setNoteData((prev) => ({ ...prev, content: newContent }));
    };

    const handleSave = () => {
        setIsSaving(true);

        // Create a new note in the database
        createNoteMutation.mutate(
            {
                note: {
                    title: noteData.title,
                    content: noteData.content,
                    condo_id: currentWorkspace.condo_id,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Note saved successfully!');
                    setIsSaving(false);
                    onSuccess();
                },
                onError: (error) => {
                    toast.error('Failed to save note: ' + error.message);
                    setIsSaving(false);
                },
            },
        );
    };

    return (
        <Card>
            <CardHeader className="pb-0">
                <Input
                    size="lg"
                    placeholder="Untitled note"
                    variant="bordered"
                    value={noteData.title}
                    classNames={{
                        inputWrapper: 'shadow-none border-0',
                        input: 'text-xl font-semibold',
                    }}
                    onChange={handleTitleChange}
                />
            </CardHeader>
            <CardBody className="p-6 pt-0 ">
                <BlockEditor
                    defaultContent={noteData.content}
                    onChange={handleContentChange}
                    placeholder="Start writing your notes here..."
                />
            </CardBody>
            <Divider />
            <CardFooter className="flex justify-between">
                <Button size="sm" variant="light" onPress={onCancel} isDisabled={isSaving}>
                    Cancel
                </Button>
                <Button size="sm" color="primary" onPress={handleSave} isLoading={isSaving}>
                    Save
                </Button>
            </CardFooter>
        </Card>
    );
};

export default NewNoteCard;
