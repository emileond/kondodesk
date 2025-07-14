import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Modal,
    ModalContent,
    Button,
    Input,
    useDisclosure,
    Spinner,
    ModalBody,
    Kbd,
} from '@heroui/react';
import {
    RiAddLine,
    RiSearchLine,
    RiQuestionLine,
    RiPaletteLine,
    RiLightbulbLine,
    RiExternalLinkLine,
} from 'react-icons/ri';
import { useFuzzySearchTasks } from '../hooks/react-query/tasks/useTasks.js';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import NewTaskModal from './tasks/NewTaskModal.jsx';
import ThemeSwitcher from './theme/ThemeSwitcher.jsx';
import debounce from '../utils/debounceUtils.js';
import { useHotkeys } from 'react-hotkeys-hook';
import UFuzzy from '@leeoniya/ufuzzy';
import TaskCard from './tasks/TaskCard.jsx';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { handleHelpClick } from '../utils/charla/handleHelpClick.js';

const CommandPalette = () => {
    const [currentWorkspace] = useCurrentWorkspace();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const { isOpen: isNewTaskModalOpen, onOpenChange: onNewTaskModalOpenChange } = useDisclosure();
    const { isOpen: isThemeSwitcherOpen, onOpenChange: onThemeSwitcherOpenChange } =
        useDisclosure();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeSection, setActiveSection] = useState('commands'); // 'commands' or 'tasks'
    const searchInputRef = useRef(null);
    const [parent] = useAutoAnimate();

    // Commands list
    const ICON_SIZE = '1.2rem';
    const commands = [
        // {
        //     id: 'ask-ai',
        //     name: 'Ask AI',
        //     leftIcon: <RiRobot2Line fontSize={ICON_SIZE} className="text-default-500" />,
        // },
        {
            id: 'new-task',
            name: 'New task',
            leftIcon: <RiAddLine fontSize={ICON_SIZE} className="text-default-500" />,
        },
        {
            id: 'change-theme',
            name: 'Change theme',
            leftIcon: <RiPaletteLine fontSize={ICON_SIZE} className="text-default-500" />,
        },
        {
            id: 'suggest-feature',
            name: 'Suggest a feature',
            leftIcon: <RiLightbulbLine fontSize={ICON_SIZE} className="text-default-500" />,
            rightIcon: <RiExternalLinkLine fontSize={ICON_SIZE} className="text-default-400" />,
        },
        {
            id: 'help',
            name: 'Help',
            leftIcon: <RiQuestionLine fontSize={ICON_SIZE} className="text-default-500" />,
        },
    ];

    // Setup UFuzzy for commands
    const uf = useMemo(
        () => new UFuzzy({ intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1 }),
        [],
    );

    // Filtered commands
    const filteredCommands = useMemo(() => {
        if (!searchTerm) return commands;
        const names = commands.map((cmd) => cmd.name);
        const results = uf.filter(names, searchTerm);
        return results ? results.map((idx) => commands[idx]) : [];
    }, [commands, searchTerm, uf]);

    // Debounce search term
    const debouncedSetSearchTerm = useCallback(
        debounce((value) => setDebouncedSearchTerm(value), 300),
        [],
    );

    useEffect(() => {
        debouncedSetSearchTerm(searchTerm);
    }, [searchTerm, debouncedSetSearchTerm]);

    // Task search
    const { data: searchData, isLoading: isSearching } = useFuzzySearchTasks(
        currentWorkspace,
        debouncedSearchTerm,
        10,
    );

    // Toggle palette
    useHotkeys('meta+k', () => onOpenChange(), [onOpenChange]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedIndex(0);
            setActiveSection('commands');
            setTimeout(() => searchInputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    // Handle arrow & enter in input
    const handleInputKeyDown = (e) => {
        if (!isOpen) return;
        const cmdCount = filteredCommands.length;
        const taskCount = searchData?.data?.length || 0;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (activeSection === 'commands') {
                    if (selectedIndex < cmdCount - 1) {
                        setSelectedIndex((i) => i + 1);
                    } else if (debouncedSearchTerm && taskCount > 0) {
                        setActiveSection('tasks');
                        setSelectedIndex(0);
                    }
                } else {
                    if (selectedIndex < taskCount - 1) {
                        setSelectedIndex((i) => i + 1);
                    }
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (activeSection === 'tasks') {
                    if (selectedIndex > 0) {
                        setSelectedIndex((i) => i - 1);
                    } else if (cmdCount > 0) {
                        setActiveSection('commands');
                        setSelectedIndex(cmdCount - 1);
                    }
                } else {
                    if (selectedIndex > 0) {
                        setSelectedIndex((i) => i - 1);
                    }
                }
                break;

            case 'Escape':
                e.preventDefault();
                onOpenChange();
                break;

            case 'Enter':
                e.preventDefault();
                if (activeSection === 'commands' && cmdCount > 0) {
                    handleCommandSelect(filteredCommands[selectedIndex].id);
                }
                break;

            default:
                // Let other keys propagate to change input
                break;
        }
    };

    const handleCommandSelect = (commandId) => {
        onOpenChange();
        switch (commandId) {
            case 'ask-ai':
                console.log('Ask AI');
                break;
            case 'new-task':
                onNewTaskModalOpenChange();
                break;
            case 'change-theme':
                onThemeSwitcherOpenChange();
                break;
            case 'suggest-feature':
                window.open('https://weekfuse.com/feature-requests', '_blank');
                break;
            case 'help':
                handleHelpClick();
                break;
            default:
                break;
        }
    };

    return (
        <>
            <Button
                variant="flat"
                size="sm"
                onPress={onOpen}
                className="text-default-500 hover:text-default-700 justify-between"
                endContent={
                    <Kbd className="text-xs" keys={['command']}>
                        K
                    </Kbd>
                }
            >
                <div className="flex items-center gap-2">
                    <RiSearchLine fontSize="1rem" /> Search
                </div>
            </Button>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" placement="top">
                <ModalContent>
                    <ModalBody className="p-0">
                        <div className="p-2" ref={parent}>
                            <Input
                                ref={searchInputRef}
                                size="lg"
                                placeholder="Search tasks or type a command..."
                                startContent={<RiSearchLine />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                className="mb-2"
                            />

                            {/* Commands */}
                            {filteredCommands.length > 0 && (
                                <div className="mb-4">
                                    <div className="text-xs text-default-500 mb-1 p-2">
                                        Commands
                                    </div>
                                    {filteredCommands.map((cmd, idx) => (
                                        <div
                                            key={cmd.id}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                                                activeSection === 'commands' &&
                                                selectedIndex === idx
                                                    ? 'bg-primary-100'
                                                    : 'hover:bg-default-100'
                                            }`}
                                            onClick={() => handleCommandSelect(cmd.id)}
                                            onMouseEnter={() => {
                                                setActiveSection('commands');
                                                setSelectedIndex(idx);
                                            }}
                                        >
                                            {cmd?.leftIcon}
                                            <span>{cmd.name}</span>
                                            {cmd?.rightIcon}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tasks */}
                            {debouncedSearchTerm && (
                                <>
                                    <div className="text-xs text-default-500 mb-1 px-2">
                                        Tasks ({searchData?.data?.length || 0})
                                    </div>
                                    {isSearching ? (
                                        <div className="flex justify-center p-4">
                                            <Spinner size="sm" />
                                        </div>
                                    ) : searchData?.data?.length > 0 ? (
                                        <div className="max-h-80 overflow-y-auto flex flex-col gap-3 p-3">
                                            {searchData.data.map((task, idx) => (
                                                <TaskCard
                                                    sm
                                                    key={task.id}
                                                    task={task}
                                                    highlighted={
                                                        activeSection === 'tasks' &&
                                                        selectedIndex === idx
                                                    }
                                                    onPress={onOpenChange}
                                                    onMouseEnter={() => {
                                                        setActiveSection('tasks');
                                                        setSelectedIndex(idx);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 text-default-500">
                                            No tasks found
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>

            <Modal isOpen={isThemeSwitcherOpen} onOpenChange={onThemeSwitcherOpenChange} size="lg">
                <ModalContent>
                    <ModalBody>
                        <ThemeSwitcher />
                    </ModalBody>
                </ModalContent>
            </Modal>

            <NewTaskModal
                isOpen={isNewTaskModalOpen}
                onOpenChange={onNewTaskModalOpenChange}
                defaultDate={null}
            />
        </>
    );
};

export default CommandPalette;
