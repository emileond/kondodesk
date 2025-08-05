import NavBar from '../components/marketing/Nav';
import { Progress } from '@heroui/react';
import Footer from '../components/marketing/Footer.jsx';
import { useFeatureRequests } from '../hooks/react-query/feature-requests/useFeatureRequests.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import FeatureRequestCard from '../components/roadmap/FeatureRequestCard.jsx';

function RoadmapPage() {
    const { data: user } = useUser();
    const { data: items, isPending } = useFeatureRequests(user, ['planned', 'in progress', 'done']);

    const columns = [
        { title: 'planned', color: 'bg-primary-200' },
        { title: 'in progress', color: 'bg-blue-200' },
        { title: 'done', color: 'bg-success-200' },
    ];

    return (
        <div className="w-screen min-h-screen bg-content2/50">
            <NavBar />
            <div className="container mx-auto max-w-[1280px] px-6 py-16">
                <h1 className="text-left text-4xl font-bold pt-12 pb-6">Roadmap</h1>
                <p className="font-medium">
                    What’s on the horizon for {import.meta.env.VITE_APP_NAME}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pt-12 pb-32">
                    {columns.map((col) => (
                        <div
                            key={col.title}
                            className="bg-content1 p-4 rounded-xl border-1 border-content3"
                        >
                            <div className="mb-3 pb-2">
                                <h2 className={`text-lg font-semibold mb-2`}>{col.title}</h2>
                                <Progress
                                    isIndeterminate={isPending}
                                    size="sm"
                                    value={100}
                                    classNames={{ indicator: `${col.color}` }}
                                    aria-label="label decorator"
                                />
                            </div>
                            <div className="space-y-3 overflow-y-auto h-[70vh] p-2">
                                {items
                                    ?.filter((item) => item.status === col.title)
                                    ?.sort(
                                        (a, b) => new Date(b.created_at) - new Date(a.created_at),
                                    )
                                    ?.map((item) => (
                                        <FeatureRequestCard
                                            key={item.id}
                                            item={item}
                                            isRoadmapCard
                                        />
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default RoadmapPage;
