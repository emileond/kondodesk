import { Button, Card, CardBody } from '@heroui/react';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import Paywall from './Paywall';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { RiArrowRightLine } from 'react-icons/ri';

function TrialEndsCard() {
    const [currentWorkspace] = useCurrentWorkspace();
    const [isPaywallOpen, setIsPaywallOpen] = useState(false);
    const navigate = useNavigate();

    const trialEndDate = dayjs(currentWorkspace.trial_ends_at);
    const daysLeft = trialEndDate.diff(dayjs(), 'day');

    const handleClick = () => {
        if (currentWorkspace?.is_ltd) {
            navigate('/settings');
        } else {
            setIsPaywallOpen(true);
        }
    };

    return (
        <>
            <Card
                shadow="none"
                isPressable
                className={`bg-gradient-to-b from-primary-100 to-content1 border-1 border-primary-300 shadow-none hover:scale-105 cursor-pointer`}
                onPress={handleClick}
            >
                <CardBody className="text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <span className="font-medium text-sm text-default-700">
                            {daysLeft > 1
                                ? `Your trial ends in ${daysLeft} days`
                                : daysLeft === 1
                                  ? 'Your trial ends in 1 day'
                                  : 'Your trial ends today'}
                        </span>

                        <Button
                            isDisabled
                            size="sm"
                            color="primary"
                            className="opacity-100 font-medium"
                            variant="shadow"
                            endContent={<RiArrowRightLine fontSize="1rem" />}
                        >
                            Get lifetime access
                        </Button>
                    </div>
                </CardBody>
            </Card>
            <Paywall
                volumePricing={false}
                isOpen={isPaywallOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsPaywallOpen(false);
                    }
                }}
                feature="unlimited access"
            />
        </>
    );
}

export default TrialEndsCard;
