import { Button } from '@heroui/react';
import { RiArrowGoBackLine, RiBardFill } from 'react-icons/ri';

function PlanningActions({ lastPlanResponse, onAutoPlan, onRollback }) {
    const handleAction = async () => {
        if (lastPlanResponse) {
            // Call rollback function
            if (onRollback.current) {
                await onRollback.current();
            }
        } else {
            // Call auto plan function
            if (onAutoPlan.current) {
                await onAutoPlan.current();
            }
        }
    };

    return (
        <Button
            onPress={handleAction}
            className="border-2 border-indigo-300 hover:border-indigo-400 bg-transparent hover:bg-content2 hover:opacity-100!"
            startContent={
                lastPlanResponse ? (
                    <RiArrowGoBackLine fontSize="1rem" />
                ) : (
                    <RiBardFill className="text-[1rem] text-indigo-600" />
                )
            }
        >
            <span className="bg-linear-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text font-medium">
                {lastPlanResponse ? 'Rollback' : 'Auto Plan'}
            </span>
        </Button>
    );
}

export default PlanningActions;
