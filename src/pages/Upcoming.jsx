import { useState, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';
import PageLayout from '../components/layout/PageLayout';
import UpcomingTasks from '../components/tasks/UpcomingTasks.jsx';
import PlanningActions from '../components/planning/PlanningActions';
import RangeDatepicker from '../components/form/RangeDatepicker.jsx';
import dayjs from 'dayjs';

function UpcomingPage() {
    const [lastPlanResponse, setLastPlanResponse] = useState(null);
    const autoPlanRef = useRef(null);
    const rollbackRef = useRef(null);

    // State for the date range is now managed at the page level.
    const [dateRange, setDateRange] = useState({
        from: dayjs().startOf('day').toDate(),
        to: dayjs().add(13, 'day').endOf('day').toDate(),
    });

    return (
        <AppLayout>
            <PageLayout
                maxW="full"
                title="Upcoming"
                startElements={
                    <RangeDatepicker
                        defaultValue={dateRange}
                        onChange={setDateRange}
                        maxDays={30}
                        preset={{ label: 'Next 2 Weeks', days: 14 }}
                    />
                }
                customElements={
                    <PlanningActions
                        lastPlanResponse={lastPlanResponse}
                        onAutoPlan={autoPlanRef}
                        onRollback={rollbackRef}
                    />
                }
            >
                <div className="flex flex-col gap-1">
                    <UpcomingTasks
                        onAutoPlan={autoPlanRef}
                        onRollback={rollbackRef}
                        lastPlanResponse={lastPlanResponse}
                        setLastPlanResponse={setLastPlanResponse}
                        dateRange={dateRange} // Pass the dateRange down as a prop
                    />
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default UpcomingPage;
