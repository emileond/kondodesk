import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import PageLayout from '../components/layout/PageLayout.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import { useNotes } from '../hooks/react-query/notes/useNotes';
import NoteCard from '../components/notes/NoteCard.jsx';
import NewNoteCard from '../components/notes/NewNoteCard.jsx';
import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import EmptyState from '../components/EmptyState';

const Notes = () => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: notes } = useNotes(currentWorkspace);
    const [isOpen, setIsOpen] = useState(false);
    const [parent] = useAutoAnimate();

    const handleOnCancel = () => {
        setIsOpen(false);
    };

    const handleOnNewNote = () => {
        setIsOpen(false);
    };

    return (
        <AppLayout>
            <PageLayout
                title="Avisos"
                maxW="3xl"
                onClick={() => setIsOpen(true)}
                primaryAction="Nuevo aviso"
            >
                <div ref={parent} className="flex flex-col gap-3 py-6">
                    {isOpen && (
                        <NewNoteCard onCancel={handleOnCancel} onSuccess={handleOnNewNote} />
                    )}
                    {notes?.length ? (
                        notes
                            .sort((a, b) => {
                                // First sort by pinned status (pinned notes first)
                                if (a.is_pinned && !b.is_pinned) return -1;
                                if (!a.is_pinned && b.is_pinned) return 1;
                                // Then sort by created_at (newest first)
                                return new Date(b.created_at) - new Date(a.created_at);
                            })
                            .map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    currentWorkspace={currentWorkspace}
                                />
                            ))
                    ) : (
                        <EmptyState
                            title="No notes found"
                            description="Create a new note to get started"
                            primaryAction="New note"
                            onClick={() => setIsOpen(true)}
                        />
                    )}
                </div>
            </PageLayout>
        </AppLayout>
    );
};

export default Notes;
