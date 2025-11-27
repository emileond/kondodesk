import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import NavBar from '../components/marketing/Nav';
import { Divider, Image } from '@heroui/react';
import { mdxComponents } from '../utils/mdxComponents.jsx';
import Footer from '../components/marketing/Footer.jsx';
import dayjs from 'dayjs';

function BlogPost() {
    const { slug } = useParams(); // Get the "slug" from the URL
    const [PostContent, setPostContent] = useState(null);
    const [postMetadata, setPostMetadata] = useState(null);

    // Load the MDX content dynamically
    useEffect(() => {
        const loadPost = async () => {
            try {
                const post = await import(`../../blog/${slug}.mdx`);
                setPostContent(() => post.default);

                // exclude default and set everything else as metadata:
                // eslint-disable-next-line no-unused-vars
                const { default: _, ...meta } = post;
                setPostMetadata(meta);
            } catch (error) {
                console.error('Error loading the post:', error);
            }
        };

        loadPost();
    }, [slug]);

    // Check if PostContent is loaded before rendering
    if (!PostContent) {
        return <p>Loading...</p>;
    }

    return (
        <div className="w-screen min-h-screen bg-content1">
            <NavBar />
            <div className="w-full max-w-(--breakpoint-md) mx-auto px-6 py-28 text-md sm:text-lg">
                <div className="pb-9 text-foreground">
                    <Image
                        width="100%"
                        alt="Cover"
                        className="object-cover w-full h-80 mb-9"
                        src={postMetadata.image || 'https://placehold.co/600x400?text=Cover'}
                    />
                    <PostContent components={mdxComponents} />
                </div>
                <Divider className="my-3" />
                <div className="flex flex-col gap-3 items-center py-9">
                    <span className="text-sm text-default-600">
                        {postMetadata?.author || 'Author'}
                    </span>
                    <span className="text-sm text-default-500">
                        {Intl.DateTimeFormat(navigator.language, {
                            dateStyle: 'long',
                        }).format(dayjs(postMetadata.date))}
                    </span>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default BlogPost;
