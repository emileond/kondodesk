import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import PageLayout from '../components/layout/PageLayout.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import { useNotes } from '../hooks/react-query/notes/useNotes';
import NoteCard from '../components/notes/NoteCard.jsx';
import NewNoteCard from '../components/notes/NewNoteCard.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import EmptyState from '../components/EmptyState';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../lib/supabase.js';
import { useSearchParams } from 'react-router-dom';

const Notes = () => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: currentUser } = useUser();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    const { data: notes } = useNotes(currentWorkspace);
    const { data: currentMember } = useQuery({
        queryKey: ['condoMember', condoId, currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('condo_members')
                .select('role')
                .eq('condo_id', condoId)
                .eq('user_id', currentUser?.id)
                .maybeSingle();
            if (error) throw new Error('Failed to fetch user role');
            return data;
        },
        enabled: !!condoId && !!currentUser?.id,
        staleTime: 1000 * 60 * 5,
    });
    const isAdmin = currentMember?.role === 'admin';
    const [isOpen, setIsOpen] = useState(false);
    const [parent] = useAutoAnimate();
    const [searchParams] = useSearchParams();
    const noteRefs = useRef(new Map());
    const focusedNoteId = searchParams.get('note');

    const sortedNotes = useMemo(
        () =>
            [...(notes || [])].sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            }),
        [notes],
    );

    useEffect(() => {
        if (!focusedNoteId || !sortedNotes.length) return;
        const el = noteRefs.current.get(focusedNoteId);
        if (el) {
            requestAnimationFrame(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
    }, [focusedNoteId, sortedNotes]);

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
                onClick={isAdmin ? () => setIsOpen(true) : undefined}
                primaryAction={isAdmin ? 'Nuevo aviso' : undefined}
            >
                <div ref={parent} className="flex flex-col gap-3 py-6">
                    {isAdmin && isOpen && (
                        <NewNoteCard onCancel={handleOnCancel} onSuccess={handleOnNewNote} />
                    )}
                    {sortedNotes.length ? (
                        sortedNotes.map((note) => (
                            <div
                                key={note.id}
                                ref={(el) => {
                                    if (el) noteRefs.current.set(note.id, el);
                                    else noteRefs.current.delete(note.id);
                                }}
                                className={
                                    focusedNoteId && focusedNoteId === String(note.id)
                                        ? 'ring-2 ring-primary-300 rounded-xl'
                                        : ''
                                }
                            >
                                <NoteCard
                                    note={note}
                                    currentWorkspace={currentWorkspace}
                                    canEdit={isAdmin}
                                />
                            </div>
                        ))
                    ) : (
                        <EmptyState
                            title="No notes found"
                            description="Create a new note to get started"
                            primaryAction={isAdmin ? 'New note' : undefined}
                            onClick={isAdmin ? () => setIsOpen(true) : undefined}
                        />
                    )}
                </div>
            </PageLayout>
        </AppLayout>
    );
};

export default Notes;
