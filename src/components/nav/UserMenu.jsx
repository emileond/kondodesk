import {
    Avatar,
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSection,
    DropdownTrigger,
    Modal,
    ModalBody,
    ModalContent,
    User,
    useDisclosure,
} from '@heroui/react';
import {
    RiExpandUpDownLine,
    RiLogoutBoxRLine,
    RiQuestionLine,
    RiMegaphoneLine,
    RiUserLine,
    RiInbox2Line,
    RiPaintBrushLine,
} from 'react-icons/ri';
import { useUser } from '../../hooks/react-query/user/useUser';
import { useLogout } from '../../hooks/react-query/user/useUser';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '../../hooks/react-query/user/useUserProfile.js';
import { useCallback, useEffect, useState } from 'react';
import ThemeSwitcher from '../theme/ThemeSwitcher.jsx';
import BoringAvatar from 'boring-avatars';
import { handleHelpClick } from '../../utils/charla/handleHelpClick.js'; // Make sure this path is correct

function UserMenu({ avatarOnly }) {
    const queryClient = useQueryClient();
    const { data: user } = useUser();
    const { data: userProfile, isPending: isUserProfilePending } = useUserProfile(user);
    const { mutateAsync: logoutUser } = useLogout();

    const [isReady, setIsReady] = useState(false); // This will be set by the 'charla:widgetLoaded' event
    const [chatOpened, setChatOpened] = useState(false); // Track if chat has been opened for the current session
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const USER_ICON_SIZE = 20;
    const ICON_SIZE = 22;

    const handleLogout = useCallback(async () => {
        await logoutUser();
        await queryClient.invalidateQueries();
    }, [logoutUser, queryClient]);

    const avatarUrl = userProfile?.avatar ? `${userProfile?.avatar}/w=60` : null;

    // useEffect to manage the 'charla:widgetLoaded' event listener
    useEffect(() => {
        const handleCharlaWidgetLoaded = () => {
            console.log('Charla widget loaded!');
            setIsReady(true); // Set isReady to true when the widget confirms loading
        };

        // Add the event listener when the component mounts
        document.addEventListener('charla:widgetLoaded', handleCharlaWidgetLoaded);

        // Cleanup function: Remove the event listener when the component unmounts
        return () => {
            document.removeEventListener('charla:widgetLoaded', handleCharlaWidgetLoaded);
        };
    }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

    // useEffect to open chat and update visitor attributes when isReady changes
    useEffect(() => {
        // Only proceed if widget is ready, user data is available, and chat hasn't been opened yet
        if (isReady && user && !chatOpened) {
            try {
                const addUserProfile = new CustomEvent('charla:updateVisitorAttributes', {
                    detail: {
                        email: user.email,
                        user_id: user.id,
                    },
                });
                document.dispatchEvent(addUserProfile);

                const charlaOpenWidgetEvent = new Event('charla:openWidget');
                document.dispatchEvent(charlaOpenWidgetEvent);

                setChatOpened(true); // Mark chat as opened to prevent re-triggering
            } catch (error) {
                console.error('Failed to initialize chat widget:', error);
            }
        }
    }, [isReady, user, chatOpened]); // Dependencies: re-run if isReady, user, or chatOpened changes

    if (!user || isUserProfilePending) return null;

    return (
        <>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
                <ModalContent>
                    <ModalBody>
                        <ThemeSwitcher />
                    </ModalBody>
                </ModalContent>
            </Modal>
            <Dropdown>
                <DropdownTrigger>
                    {avatarOnly ? (
                        <Avatar showFallback src={avatarUrl} size="sm" className="cursor-pointer" />
                    ) : (
                        <User
                            as={Button}
                            variant="bordered"
                            size="lg"
                            className="justify-between px-3 border"
                            startContent={
                                !avatarUrl && (
                                    <BoringAvatar
                                        name={userProfile?.name || userProfile?.email}
                                        size={ICON_SIZE + 10}
                                        variant="beam"
                                        colors={['#fbbf24', '#735587', '#5bc0be', '#6366f1']}
                                    />
                                )
                            }
                            endContent={<RiExpandUpDownLine fontSize={ICON_SIZE - 6} />}
                            name={userProfile?.name || 'User'}
                            description={user?.email || 'email'}
                            avatarProps={{
                                size: 'sm',
                                src: avatarUrl,
                                className: !avatarUrl && 'hidden',
                            }}
                        />
                    )}
                </DropdownTrigger>
                <DropdownMenu>
                    <DropdownSection showDivider>
                        <DropdownItem textValue="user">
                            <User
                                name={userProfile?.name || 'User'}
                                description={user?.email || 'email'}
                                avatarProps={{
                                    className: 'hidden',
                                    src: avatarUrl,
                                }}
                            />
                        </DropdownItem>
                    </DropdownSection>
                    <DropdownSection showDivider>
                        <DropdownItem
                            // className="taku-launcher"
                            onPress={() => window.Taku('news:show')}
                            startContent={<RiMegaphoneLine fontSize={USER_ICON_SIZE} />}
                        >
                            {`What's new`}
                        </DropdownItem>
                        <DropdownItem
                            startContent={<RiQuestionLine fontSize={USER_ICON_SIZE} />}
                            onPress={() => {
                                handleHelpClick();
                                setChatOpened(false);
                            }}
                        >
                            Help
                        </DropdownItem>
                    </DropdownSection>
                    <DropdownSection>
                        <DropdownItem
                            startContent={<RiPaintBrushLine fontSize={USER_ICON_SIZE} />}
                            onPress={onOpenChange}
                        >
                            Change theme
                        </DropdownItem>
                        {[
                            {
                                name: 'Profile',
                                path: '/settings/profile',
                                startContent: <RiUserLine fontSize={USER_ICON_SIZE} />,
                            },
                            {
                                name: 'Invitations',
                                path: '/settings/invitations',
                                startContent: <RiInbox2Line fontSize={USER_ICON_SIZE} />,
                            },
                            {
                                name: 'Log Out',
                                action: handleLogout,
                                startContent: <RiLogoutBoxRLine fontSize={USER_ICON_SIZE} />,
                            },
                        ].map((route, index) => (
                            <DropdownItem
                                as={route.path && Link}
                                key={index}
                                to={route.path}
                                onPress={route.action}
                                startContent={route?.startContent}
                                className={`items-center justify-start ${route.name === 'Log Out' && 'text-danger'}`}
                                color={route.name === 'Log Out' ? 'danger' : 'default'}
                            >
                                {route.name}
                            </DropdownItem>
                        ))}
                    </DropdownSection>
                </DropdownMenu>
            </Dropdown>
        </>
    );
}

export default UserMenu;
