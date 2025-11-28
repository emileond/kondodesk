'use client';
import { useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';
import { Button, Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine } from 'react-icons/ri';

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
            className="flex items-center justify-center relative py-10 px-2 md:px-20 bg-linear-to-b from-primary-50/50 to-primary-50/0"
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
                                Prueba gratis 14 días, sin tarjeta
                            </Chip>
                            <div className="text-4xl font-semibold space-y-3">
                                <span className="text-default-500">Administra tus amenidades</span>
                                <h1>
                                    <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-default-800">
                                        Sin complicaciones.
                                    </span>
                                </h1>
                            </div>
                            <p className="max-w-2xl text-lg mx-auto text-default-600 text-balance py-6">
                                Kondodesk centraliza las reservas de gimnasio, canchas, salones y
                                terrazas, y te permite compartir avisos con todos los residentes
                                desde un solo lugar.
                            </p>

                            <Button
                                as={Link}
                                to="/signup"
                                size="lg"
                                color="primary"
                                variant="shadow"
                                className="mb-12"
                            >
                                Empezar ahora
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
            className="max-w-5xl -mt-12 mx-auto w-full border-4 border-[#6C6C6C] p-2 md:p-3 bg-[#222222] rounded-[30px] shadow-2xl"
        >
            <div className="w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl">
                {children}
            </div>
        </motion.div>
    );
};
