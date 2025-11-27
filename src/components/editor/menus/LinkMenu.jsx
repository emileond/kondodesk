import React, { useState, useEffect } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Button, Input, Tooltip } from '@heroui/react';
import { RiExternalLinkLine, RiEditLine, RiDeleteBin2Line } from 'react-icons/ri';

export const LinkMenu = ({ editor, appendTo }) => {
    const [url, setUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (editor && editor.isActive('link')) {
            setUrl(editor.getAttributes('link').href || '');
        }
    }, [editor]);

    const shouldShow = ({ editor }) => {
        return editor.isActive('link');
    };

    const handleSave = () => {
        if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        } else {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    const handleRemove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
    };

    const handleOpen = () => {
        const href = editor.getAttributes('link').href;
        if (href) {
            window.open(href, '_blank');
        }
    };

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
            tippyOptions={{
                appendTo: () => appendTo?.current || document.body,
                placement: 'bottom',
                interactive: true,
            }}
        >
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-default-200 shadow-md">
                {isEditing ? (
                    <>
                        <Input
                            size="sm"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="min-w-[200px]"
                        />
                        <Button size="sm" color="primary" onPress={handleSave}>
                            Save
                        </Button>
                    </>
                ) : (
                    <>
                        <span className="text-sm text-default-700 truncate max-w-[200px]">
                            {editor.getAttributes('link').href}
                        </span>
                        <div className="flex items-center gap-1">
                            <Tooltip content="Open link">
                                <Button isIconOnly size="sm" variant="light" onPress={handleOpen}>
                                    <RiExternalLinkLine />
                                </Button>
                            </Tooltip>
                            <Tooltip content="Edit link">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    onPress={() => setIsEditing(true)}
                                >
                                    <RiEditLine />
                                </Button>
                            </Tooltip>
                            <Tooltip content="Remove link">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onPress={handleRemove}
                                >
                                    <RiDeleteBin2Line />
                                </Button>
                            </Tooltip>
                        </div>
                    </>
                )}
            </div>
        </BubbleMenu>
    );
};

export default LinkMenu;
