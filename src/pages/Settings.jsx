import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import SettingsProfileTab from '../components/settings/SettingsProfileTab.jsx';

function ProfilePage() {
    return (
        <AppLayout>
            <PageLayout title="Settings" maxW="4xl">
                <div className="w-full flex flex-col">
                    <SettingsProfileTab />
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default ProfilePage;
