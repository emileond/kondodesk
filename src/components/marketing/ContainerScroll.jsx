'use client';
import { useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';
import { Button, Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import {
    RiArrowRightFill,
    RiArrowRightLine,
    RiArrowRightSFill,
    RiArrowRightSLine,
    RiFireFill,
    RiRocket2Fill,
    RiRocketFill,
} from 'react-icons/ri';

export const ContainerScroll = ({ children }) => {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
    });
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    const scaleDimensions = () => {
        return isMobile ? [0.7, 0.9] : [1.05, 1];
    };

    const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
    const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

    return (
        <div
            className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20 bg-gradient-to-b from-primary-50/50 to-primary-50/0"
            ref={containerRef}
        >
            <div
                className="py-10 md:py-40 w-full relative"
                style={{
                    perspective: '1000px',
                }}
            >
                <Header
                    translate={translate}
                    titleComponent={
                        <>
                            <Chip
                                as={Link}
                                to="/signup"
                                variant="flat"
                                size="sm"
                                color="primary"
                                endContent={<RiArrowRightLine fontSize="1rem" />}
                                className="mb-6"
                            >
                                Special launch offer. Pay once, use forever.
                            </Chip>
                            <div className="text-4xl font-semibold space-y-3">
                                <span className="text-default-500">Achieve Your Goals,</span>
                                <h1>
                                    <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-default-800">
                                        Find Your Flow.
                                    </span>
                                </h1>
                            </div>
                            <p className="max-w-2xl text-lg mx-auto text-default-600 text-balance py-6">
                                Weekfuse centralizes your tasks, plans your week, and guides your
                                reflection so you can achieve more without the overwhelm
                            </p>

                            <Button
                                as={Link}
                                to="/signup"
                                size="lg"
                                color="primary"
                                variant="shadow"
                                className="mb-12"
                            >
                                Unlock Lifetime Access
                            </Button>
                        </>
                    }
                />
                <Card rotate={rotate} translate={translate} scale={scale}>
                    {children}
                </Card>
            </div>
        </div>
    );
};

export const Header = ({ translate, titleComponent }) => {
    return (
        <motion.div
            style={{
                translateY: translate,
            }}
            className="div max-w-5xl mx-auto text-center"
        >
            {titleComponent}
        </motion.div>
    );
};

export const Card = ({ rotate, scale, children }) => {
    return (
        <motion.div
            style={{
                rotateX: rotate,
                scale,
                boxShadow:
                    '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
            }}
            className="max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-[#6C6C6C] p-2 md:p-3 bg-[#222222] rounded-[30px] shadow-2xl"
        >
            <div className=" h-full w-full  overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl">
                {children}
            </div>
        </motion.div>
    );
};
