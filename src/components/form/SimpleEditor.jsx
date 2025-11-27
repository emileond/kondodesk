import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import ky from 'ky';
import toast from 'react-hot-toast';
import { markdownToTipTap } from '../../utils/editorUtils.js';
import { RiBardFill } from 'react-icons/ri';

// Import editor fixes
import '../editor/editor-fixes.css';

const SimpleEditor = ({
    defaultContent = '',
    label,
    onChange,
    isEditable = true,
    taskName = '',
    tags = [],
}) => {
    const extensions = [
        StarterKit.configure(),
        Typography,
        Highlight,
        TaskList,
        TaskItem.configure({
            nested: true,
        }),
        Mention.configure({
            HTMLAttributes: {
                class: 'text-blue',
            },

            renderHTML({ options, node }) {
                return [
                    'a',
                    mergeAttributes({ href: '#' }, options.HTMLAttributes),
                    `${node.attrs.label ?? options.suggestion.char + node.attrs.id}`,
                ];
            },
        }),
    ];

    let content = null;
    try {
        if (typeof defaultContent === 'string' && defaultContent.trim().startsWith('{')) {
            content = JSON.parse(defaultContent);
        } else if (typeof defaultContent === 'object' && defaultContent !== null) {
            content = defaultContent;
        }
    } catch (e) {
        console.error('Error parsing content for SimpleEditor:', e);
        content = null; // Fallback to an empty editor on error
    }

    const editor = useEditor({
        extensions,
        content: content ?? null,
        editable: isEditable,
        editorProps: {
            attributes: {
                class: `text-foreground prose prose-sm dark:prose-invert prose-a:text-blue-500 focus:outline-none min-h-48 p-3 max-w-full rounded-lg border-2 border-default-200 ${isEditable && 'hover:border-default-300'}`,
            },
        },
        onUpdate: ({ editor }) => {
            const newContent = editor.getJSON();
            if (onChange) {
                return onChange(newContent);
            }
        },
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleWriteWithAI = async () => {
        setIsLoading(true);
        try {
            // Get current content if available
            const currentContent = editor ? editor.getJSON() : null;

            // Extract tag labels from the tags array
            const tagLabels = tags.map((tag) => tag.label).filter(Boolean);

            const response = await ky
                .post('/api/ai/write-description', {
                    json: {
                        taskName,
                        tags: tagLabels,
                        currentContent,
                    },
                })
                .json();

            if (response.description) {
                // Convert the plain text to the format expected by SimpleEditor
                const formattedDescription = markdownToTipTap(response.description);

                // Update the editor content
                editor.commands.setContent(formattedDescription);

                // Call onChange to update parent component state
                if (onChange) {
                    onChange(formattedDescription);
                }

                toast.success('Description generated with AI');
            }
        } catch (error) {
            toast.error('Failed to generate description');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // This check is still valid and important.
        if (!editor) {
            return;
        }

        const editorContent = editor.getJSON();

        // Use stringify to compare. This is still correct.
        if (JSON.stringify(content) !== JSON.stringify(editorContent)) {
            editor.commands.setContent(content || '', false);
        }
    }, [content, editor]);

    return (
        <div>
            <div className="flex gap-2 items-center mb-2">
                {label && (
                    <span className="text-sm block font-medium text-foreground">{label}</span>
                )}
                {isEditable && taskName && (
                    <Button
                        size="sm"
                        variant="light"
                        isLoading={isLoading}
                        className="hover:!bg-content3"
                        startContent={<RiBardFill className="text-[1rem] text-indigo-500" />}
                        onPress={handleWriteWithAI}
                    >
                        <span className="bg-linear-to-r from-indigo-500 to-violet-500 text-transparent bg-clip-text font-medium">
                            Write with AI
                        </span>
                    </Button>
                )}
            </div>
            <EditorContent editor={editor} />
        </div>
    );
};

export default SimpleEditor;
