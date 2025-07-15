import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Alert } from '@heroui/react'; // Assuming this is your Alert component
import { RiThumbUpLine, RiSparkling2Line, RiErrorWarningLine } from 'react-icons/ri';

const insights = [
    {
        description: 'You completed 18 tasks last week, beating your average by 15%.',
        icon: <RiThumbUpLine fontSize="1.2rem" />,
        classNames: { alertIcon: 'text-success' },
    },
    {
        description: 'It looks like most of your tasks are completed before noon.',
        icon: <RiSparkling2Line fontSize="1.2rem" />,
        classNames: { alertIcon: 'text-primary' },
    },
    {
        description: "You had 3 tasks slip into overdue last week. Let's get them on track.",
        icon: <RiErrorWarningLine fontSize="1.2rem" />,
        classNames: { alertIcon: 'text-danger' },
    },
];

const AnimatedInsights = () => {
    // This state now tracks which item is "active" or highlighted
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        // Set up an interval to change the active index every 2.5 seconds
        const interval = setInterval(() => {
            setActiveIndex((prevIndex) => (prevIndex + 1) % insights.length);
        }, 2500); // 2.5 seconds

        // Clear the interval on unmount
        return () => clearInterval(interval);
    }, []);

    // Define animation styles for "active" and "inactive" states
    const itemVariants = {
        inactive: {
            scale: 1,
            boxShadow: '0px 0px 0px rgba(0,0,0,0)', // No shadow
            transition: { type: 'spring', stiffness: 400, damping: 30 },
        },
        active: {
            scale: 1.05,
            boxShadow: '0px 10px 25px -5px rgba(0, 0, 0, 0.3)', // Soft shadow
            transition: { type: 'spring', stiffness: 400, damping: 30 },
        },
    };

    return (
        <div className="space-y-3 scale-90 py-3">
            {insights.map((insight, index) => (
                <motion.div
                    key={index}
                    variants={itemVariants}
                    // Conditionally apply the 'active' or 'inactive' variant
                    animate={index === activeIndex ? 'active' : 'inactive'}
                    // Apply border styles to the motion.div for the animation to work
                    className="border-2 border-content4 rounded-xl"
                >
                    <Alert
                        // Make the Alert's own background transparent so we can see the animated one
                        className="bg-content2/50"
                        description={insight.description}
                        classNames={insight.classNames}
                        icon={insight.icon}
                    />
                </motion.div>
            ))}
        </div>
    );
};

export default AnimatedInsights;
