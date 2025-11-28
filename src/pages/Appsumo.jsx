import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
import ky from 'ky';
import NavBar from '../components/marketing/Nav.jsx';
import Footer from '../components/marketing/Footer.jsx';
import { useUser, useLogout } from '../hooks/react-query/user/useUser.js';
import { useWorkspaces } from '../hooks/react-query/condos/useWorkspaces.js';
import AuthForm from '../components/auth/AuthForm.jsx';
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, Link } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

function AppsumoPage() {
    const { data: user } = useUser();
    const { data: workspaces } = useWorkspaces(user);
    const queryClient = useQueryClient();
    const location = useLocation();
    const navigate = useNavigate(); // <-- Use useNavigate hook
    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('code');
    const [license, setLicense] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { mutateAsync: logoutUser } = useLogout();

    const handleLogout = useCallback(async () => {
        await logoutUser();
        await queryClient.invalidateQueries();
    }, [logoutUser, queryClient]);

    async function fetchLicense() {
        if (!code) {
            setError('Appsumo code is missing');
            return;
        }

        const { workspace_id } = workspaces.find((w) => w.role === 'owner');

        setIsLoading(true);
        setError(null);

        try {
            const response = await ky
                .post('/api/appsumo/get-user-license', {
                    json: { code, workspace_id, user_id: user.id },
                    throwHttpErrors: false, // Prevent ky from throwing on non-2xx responses
                })
                .json();

            if (response.license_key) {
                setLicense(response.license_key);
                toast.success('Congratulations! Your AppSumo LTD Plan is now active');
                navigate('/dashboard');
            } else {
                setError(
                    response.error_description || response.error || 'Failed to retrieve license',
                );
                console.error('License fetch error:', response);
            }
        } catch (err) {
            console.error('Request failed:', err);
            setError(err.message || 'An error occurred while fetching the license.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="w-screen">
            <NavBar />
            <div className="p-20 min-h-[70vh] items-center flex flex-col gap-3">
                <Card shadow="sm" className="p-4">
                    <CardHeader className="flex flex-col gap-3">
                        <h1 className="font-bold">Welcome Sumo-ling!</h1>
                        <p>{`You're one step away from activating your LTD plan.`}</p>
                    </CardHeader>
                    <CardBody>
                        {!user ? (
                            <div className="flex flex-col gap-3 max-w-2xl">
                                <Alert
                                    title="Login to Activate Your LTD Plan"
                                    description="To redeem your LTD plan, please log in with your existing account, or create one if you don't have one yet."
                                />
                                <AuthForm hideHeader viewMode="login" />
                                <p className="mt-4 text-center">
                                    Don’t have an account?{' '}
                                    <Link
                                        href="https://mailerfuse.com/signup"
                                        isExternal
                                        className="text-primary font-semibold"
                                    >
                                        Create one here
                                    </Link>
                                    .
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 items-center max-w-2xl">
                                {!error && !license && (
                                    <Alert
                                        color="primary"
                                        title={`You're about to activate the LTD plan on: ${user?.email}`}
                                        description={`If this is not the account you want to use, please log out to use a different account.`}
                                    />
                                )}
                                {error && (
                                    <Alert color="danger" title="Error" description={error} />
                                )}
                                <CardFooter>
                                    {!license && (
                                        <div className="w-full flex flex-col items-center gap-3">
                                            <Button
                                                color="secondary"
                                                size="lg"
                                                isLoading={isLoading}
                                                onPress={fetchLicense}
                                            >
                                                Confirm and Activate LTD Plan
                                            </Button>
                                            <span className="text-gray-500">OR</span>
                                            <Button
                                                isDisabled={isLoading}
                                                variant="bordered"
                                                size="lg"
                                                onPress={handleLogout}
                                            >
                                                Log out
                                            </Button>
                                        </div>
                                    )}
                                </CardFooter>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
            <Footer />
        </div>
    );
}

export default AppsumoPage;
