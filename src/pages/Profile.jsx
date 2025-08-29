import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import { Tabs, Tab } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useUserInvitations } from '../hooks/react-query/user/useUserInvitations.js';
import InvitationCard from '../components/team/InvitationCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { RiEqualizer2Line, RiInboxLine, RiNotificationLine, RiUserLine } from 'react-icons/ri';
import SettingsGeneralTab from '../components/settings/SettingsGeneralTab.jsx';
import SettingsProfileTab from '../components/settings/SettingsProfileTab.jsx';
import SettingsRemindersTab from '../components/settings/SettingsRemindersTab.jsx';

function ProfilePage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { user } = useUser();
    const { data: invitations } = useUserInvitations(user, currentWorkspace);

    const navigate = useNavigate();
    const { tab } = useParams();
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        if (tab) {
            setActiveTab(tab);
        } else {
            setActiveTab('general');
        }
    }, [tab]);

    return (
        <AppLayout>
            <PageLayout title="Settings" maxW="4xl">
                <div className="w-full flex flex-col">
                    <Tabs
                        isVertical
                        selectedKey={activeTab}
                        onSelectionChange={(tab) => {
                            setActiveTab(tab);
                            navigate(`/settings/${tab}`, { replace: true });
                        }}
                        classNames={{ tab: 'justify-start' }}
                    >
                        <Tab
                            key="general"
                            title={
                                <div className="flex items-center gap-2">
                                    <RiEqualizer2Line />
                                    General
                                </div>
                            }
                            className="grow"
                        >
                            <SettingsGeneralTab />
                        </Tab>
                        <Tab
                            key="profile"
                            title={
                                <div className="flex items-center gap-2">
                                    <RiUserLine />
                                    Profile
                                </div>
                            }
                            className="grow"
                        >
                            <SettingsProfileTab />
                        </Tab>
                        <Tab
                            key="reminders"
                            title={
                                <div className="flex items-center gap-2">
                                    <RiNotificationLine />
                                    Reminders
                                </div>
                            }
                            className="grow"
                        >
                            <SettingsRemindersTab />
                        </Tab>
                        <Tab
                            key="invitations"
                            title={
                                <div className="flex items-center gap-2">
                                    <RiInboxLine />
                                    Invitations
                                </div>
                            }
                            className="grow"
                        >
                            <div className="flex flex-col gap-3">
                                {invitations?.length ? (
                                    invitations?.map((inv) => (
                                        <InvitationCard key={inv.id} invitation={inv} />
                                    ))
                                ) : (
                                    <EmptyState
                                        title="No Invitations"
                                        description="When you receive an invitation to join another workspace, it will appear here."
                                    />
                                )}
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default ProfilePage;
