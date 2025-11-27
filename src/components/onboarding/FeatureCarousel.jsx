import { useState } from 'react';
import { Progress, Button, Modal, ModalContent, ModalBody, ModalFooter } from '@heroui/react';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from 'react-icons/ri';
import { motion, AnimatePresence } from 'framer-motion';

function FeatureCarousel({ features, onClose, backgroundImage }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0); // 1 for forward, -1 for backward
    const [isAnimating, setIsAnimating] = useState(false);

    const transition = {
        type: 'spring',
        stiffness: 260,
        damping: 30,
    };

    const goToNext = () => {
        if (isAnimating) return;
        if (currentIndex < features.length - 1) {
            setDirection(1);
            setIsAnimating(true);
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const goToPrevious = () => {
        if (isAnimating) return;
        if (currentIndex > 0) {
            setDirection(-1);
            setIsAnimating(true);
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleAnimationComplete = () => {
        setIsAnimating(false);
    };

    const currentFeature = features[currentIndex];

    // Animation variants
    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? '30%' : '-30%',
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition,
        },
        exit: (direction) => ({
            x: direction > 0 ? -1000 : 1000,
            opacity: 0,
            scale: 0.8,
            transition: {
                duration: 0.5,
            },
        }),
    };

    // Staggered animation for content elements
    const contentVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (custom) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: custom * 0.15,
                duration: 0.5,
                ease: 'easeOut',
            },
        }),
    };

    // Background animation
    const backgroundVariants = {
        initial: {
            backgroundPosition: '0% 0%',
            filter: 'brightness(0.8) saturate(0.8)',
        },
        animate: {
            backgroundPosition: '100% 100%',
            filter: 'brightness(1) saturate(1)',
            transition: {
                duration: 20,
                ease: 'linear',
                repeat: Infinity,
                repeatType: 'reverse',
            },
        },
    };

    return (
        <Modal
            size="2xl"
            isOpen={true}
            onClose={onClose}
            hideCloseButton
            backdrop="blur"
            classNames={{
                backdrop: 'bg-black/50',
            }}
        >
            <ModalContent>
                <motion.div
                    className="absolute inset-0 z-0 opacity-30"
                    style={{
                        backgroundImage: backgroundImage
                            ? `url(${backgroundImage})`
                            : 'linear-gradient(45deg, #8b5cf6, #3b82f6)',
                        backgroundSize: '200% 200%',
                    }}
                    variants={backgroundVariants}
                    initial="initial"
                    animate="animate"
                />

                <ModalBody className="overflow-hidden min-h-[430px]">
                    <div className="absolute top-4 right-4 z-10">
                        <Button isIconOnly variant="light" aria-label="Close" onPress={onClose}>
                            <RiCloseLine size={20} />
                        </Button>
                    </div>

                    <div className="p-8 relative">
                        <AnimatePresence
                            initial={false}
                            custom={direction}
                            mode="popLayout"
                            onExitComplete={handleAnimationComplete}
                        >
                            <motion.div
                                key={currentIndex}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="min-h-[300px] flex flex-col gap-6 relative"
                            >
                                <motion.div
                                    className="mb-6 text-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate="visible"
                                    custom={0}
                                >
                                    <motion.h1
                                        className="text-2xl font-semibold mb-6"
                                        variants={contentVariants}
                                        initial="hidden"
                                        animate="visible"
                                        custom={0.5}
                                    >
                                        {currentFeature.title}
                                    </motion.h1>
                                    <motion.p
                                        className="text-default-600 text-pretty"
                                        variants={contentVariants}
                                        initial="hidden"
                                        animate="visible"
                                        custom={1}
                                    >
                                        {currentFeature.description}
                                    </motion.p>
                                </motion.div>
                                <motion.div
                                    className="grow flex items-center justify-center"
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate="visible"
                                    custom={1.5}
                                >
                                    {currentFeature.content}
                                </motion.div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-between items-center p-6 relative z-10 backdrop-blur-sm bg-content1/30">
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            isIconOnly
                            variant="light"
                            aria-label="Previous"
                            onPress={goToPrevious}
                            isDisabled={currentIndex === 0 || isAnimating}
                        >
                            <RiArrowLeftLine size={20} />
                        </Button>
                    </motion.div>

                    <div className="grow mx-4">
                        <div className="flex gap-2 justify-center">
                            {features.map((_, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ scale: 0.8 }}
                                    animate={{
                                        scale: index === currentIndex ? 1.1 : 1,
                                        transition: { duration: 0.3 },
                                    }}
                                    className={index === currentIndex ? 'relative' : ''}
                                >
                                    {/* Add glowing effect for current slide */}
                                    {index === currentIndex && (
                                        <motion.div
                                            className="absolute inset-0 bg-secondary-400 rounded-lg -z-10"
                                            initial={{ opacity: 0, scale: 1 }}
                                            animate={{
                                                opacity: [0.5, 0.8, 0.5],
                                                scale: [1, 1.3, 1],
                                                filter: ['blur(8px)', 'blur(12px)', 'blur(8px)'],
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatType: 'reverse',
                                            }}
                                        />
                                    )}
                                    <Progress
                                        key={index}
                                        size="sm"
                                        color={index <= currentIndex ? 'secondary' : 'default'}
                                        value={index <= currentIndex ? 100 : 0}
                                        className={`w-16 ${index === currentIndex ? 'z-10' : ''}`}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                    <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        animate={isAnimating ? { opacity: 0.5 } : { opacity: 1 }}
                    >
                        <Button
                            isIconOnly
                            variant="light"
                            aria-label="Next"
                            onPress={goToNext}
                            isDisabled={isAnimating}
                        >
                            <motion.div
                                className="absolute inset-0 bg-primary-200/20"
                                initial={{ scale: 0, opacity: 0 }}
                                whileHover={{ scale: 1.5, opacity: 0.4 }}
                                transition={{ duration: 0.4 }}
                            />
                            <RiArrowRightLine size={20} />
                        </Button>
                    </motion.div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export default FeatureCarousel;
