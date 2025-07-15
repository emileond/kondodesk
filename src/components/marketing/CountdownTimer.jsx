import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CountdownItem = ({ value, label }) => {
    return (
        <div className="flex flex-col items-center">
            <div className="relative h-12 w-12 overflow-hidden">
                <AnimatePresence>
                    <motion.div
                        key={value}
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '-100%' }}
                        transition={{ ease: 'circInOut', duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <span className="text-2xl font-bold text-foreground">
                            {String(value).padStart(2, '0')}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>
            <span className="text-xs uppercase tracking-wider text-default-600">{label}</span>
        </div>
    );
};

const CountdownTimer = ({ targetDate }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        // Clear timeout if the component is unmounted
        return () => clearTimeout(timer);
    });

    const timerComponents = [];
    Object.keys(timeLeft).forEach((interval) => {
        if (timeLeft[interval] === undefined) {
            return;
        }
        timerComponents.push(
            <CountdownItem key={interval} value={timeLeft[interval]} label={interval} />,
        );
    });

    return (
        <div className="text-center py-3 bg-gradient-to-br from-primary-50/40 to-primary-100 border-2 border-primary-200 rounded-xl w-full max-w-screen-sm">
            <span className="text-sm font-semibold text-primary">This offer ends soon!</span>
            <div className="flex justify-center gap-6">
                {timerComponents.length ? (
                    timerComponents
                ) : (
                    <span className="text-xl font-semibold text-primary">The offer has ended!</span>
                )}
            </div>
        </div>
    );
};

export default CountdownTimer;
