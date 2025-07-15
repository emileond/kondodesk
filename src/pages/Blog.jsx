import { Link } from 'react-router-dom';
import NavBar from '../components/marketing/Nav';
import { Card, CardBody, CardFooter, Image } from '@heroui/react';
import Footer from '../components/marketing/Footer.jsx';
import dayjs from 'dayjs';

const posts = import.meta.glob('../../blog/*.mdx', { eager: true });

function BlogPage() {
    return (
        <div className="w-screen min-h-screen bg-content1 py-16">
            <NavBar />
            <h1 className="text-center text-4xl font-bold py-12">Blog</h1>
            <div className="max-w-6xl min-h-[60vh] mx-auto grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 py-12 px-6">
                {Object.entries(posts).map(([path, post]) => {
                    const slug = path.replace('../../blog/', '').replace('.mdx', '');
                    return (
                        <Card
                            as={Link}
                            to={`/blog/${slug}`}
                            isPressable
                            key={post.title}
                            className="min-h-80 max-h-[360px]"
                        >
                            <CardBody>
                                <Image
                                    src={
                                        post?.image || 'https://placehold.co/600x400?text=No+Image'
                                    }
                                    alt={post.title}
                                    width="100%"
                                    className="w-full object-cover h-[180px] mb-6"
                                />
                                <span className="font-semibold">{post.title}</span>
                            </CardBody>
                            <CardFooter>
                                <span className="text-sm text-default-500">
                                    {Intl.DateTimeFormat(navigator.language, {
                                        dateStyle: 'long',
                                    }).format(dayjs(post.date))}
                                </span>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
            <Footer />
        </div>
    );
}

export default BlogPage;
