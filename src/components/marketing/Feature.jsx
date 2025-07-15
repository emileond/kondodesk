import { Button, Card, CardBody, Chip, Image } from '@heroui/react';
import { Link } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

function Feature({
    heading,
    description,
    ctaText,
    imageUrl,
    lottie,
    loop,
    reverse = false,
    id,
    childComponent,
    chip,
}) {
    return (
        <div className="flex items-center justify-center w-full mb-16">
            <Card shadow="md" id={id} className="grow max-w-6xl">
                <CardBody
                    className={`w-full flex flex-col p-8 min-h-[35vh] max-w-screen-lg mx-auto ${
                        reverse ? 'md:flex-row' : 'md:flex-row-reverse'
                    } items-center justify-center gap-8`}
                >
                    {/* Image Section */}
                    {imageUrl && (
                        <div className="w-full md:w-1/2">
                            <Image
                                src={imageUrl}
                                alt={heading}
                                className="w-full h-auto rounded-lg"
                            />
                        </div>
                    )}
                    {lottie && <DotLottieReact src={`/lottie/${lottie}`} autoplay loop={true} />}

                    {childComponent && childComponent}

                    {/* Content Section */}
                    <div className="w-full md:w-1/2 flex flex-col justify-center">
                        {chip && (
                            <Chip size="sm" color="primary" variant="faded" className="mb-3">
                                {chip}
                            </Chip>
                        )}
                        <h2 className="text-3xl font-bold mb-4 text-default-700">{heading}</h2>
                        <p className="text-lg text-default-500 mb-6">{description}</p>
                        {ctaText && (
                            <div>
                                <Button as={Link} to="/signup" color="primary" size="lg">
                                    {ctaText}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

export default Feature;
