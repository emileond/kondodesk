import { BubbleMenu } from '@tiptap/react/menus';
import { Button, Tooltip, Divider } from '@heroui/react';
import {
    RiBold,
    RiItalic,
    RiUnderline,
    RiStrikethrough,
    RiH1,
    RiH2,
    RiH3,
    RiCodeSSlashLine,
    RiCodeBoxLine,
    RiLink,
    RiAlignLeft,
    RiAlignCenter,
    RiAlignRight,
    RiListOrdered,
    RiListUnordered,
    RiListCheck2,
} from 'react-icons/ri';

export const TextMenu = ({ editor }) => {
    if (!editor) {
        return null;
    }

    const shouldShow = ({ editor, view, state, from, to }) => {
        const { doc, selection } = state;
        const { empty } = selection;

        // Don't show menu if selection is empty or if it spans multiple blocks
        if (empty) return false;

        return true;
    };

    const ICON_SIZE = '1.2rem';
    const COLOR = 'text-default-600';

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
            tippyOptions={{
                placement: 'top',
                maxWidth: 'calc(100vw - 16px)',
            }}
        >
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-background border border-default-200 shadow-md">
                <div className="flex items-center gap-1">
                    <Tooltip content="Bold (Ctrl+B)">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('bold') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleBold().run()}
                            className={COLOR}
                        >
                            <RiBold fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Italic (Ctrl+I)">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('italic') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleItalic().run()}
                            className={COLOR}
                        >
                            <RiItalic fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Underline (Ctrl+U)">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('underline') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleUnderline().run()}
                            className={COLOR}
                        >
                            <RiUnderline fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Strikethrough">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('strike') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleStrike().run()}
                            className={COLOR}
                        >
                            <RiStrikethrough fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>
                </div>

                <Divider orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                    <Tooltip content="Heading 1">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('heading', { level: 1 }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={COLOR}
                        >
                            <RiH1 fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Heading 2">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('heading', { level: 2 }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={COLOR}
                        >
                            <RiH2 fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Heading 3">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('heading', { level: 3 }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            className={COLOR}
                        >
                            <RiH3 fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>
                </div>

                <Divider orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                    <Tooltip content="Bullet List">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('bulletList') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleBulletList().run()}
                            className={COLOR}
                        >
                            <RiListUnordered fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Ordered List">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('orderedList') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleOrderedList().run()}
                            className={COLOR}
                        >
                            <RiListOrdered fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Task List">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('taskList') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleTaskList().run()}
                            className={COLOR}
                        >
                            <RiListCheck2 fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>
                </div>

                <Divider orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                    <Tooltip content="Code">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('code') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleCode().run()}
                            className={COLOR}
                        >
                            <RiCodeSSlashLine fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Code Block">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('codeBlock') ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().toggleCodeBlock().run()}
                            className={COLOR}
                        >
                            <RiCodeBoxLine fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Link">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive('link') ? 'solid' : 'light'}
                            className={COLOR}
                            onPress={() => {
                                const url = window.prompt('URL');
                                if (url) {
                                    editor.chain().focus().setLink({ href: url }).run();
                                }
                            }}
                        >
                            <RiLink fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>
                </div>

                <Divider orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                    <Tooltip content="Align Left">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive({ textAlign: 'left' }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().setTextAlign('left').run()}
                            className={COLOR}
                        >
                            <RiAlignLeft fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Align Center">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive({ textAlign: 'center' }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().setTextAlign('center').run()}
                            className={COLOR}
                        >
                            <RiAlignCenter fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>

                    <Tooltip content="Align Right">
                        <Button
                            isIconOnly
                            size="sm"
                            variant={editor.isActive({ textAlign: 'right' }) ? 'solid' : 'light'}
                            onPress={() => editor.chain().focus().setTextAlign('right').run()}
                            className={COLOR}
                        >
                            <RiAlignRight fontSize={ICON_SIZE} />
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </BubbleMenu>
    );
};

export default TextMenu;
