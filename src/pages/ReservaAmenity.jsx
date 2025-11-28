import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';
import dayjs from 'dayjs';
import { Chip } from '@heroui/react';
import AppLayout from '../components/layout/AppLayout.jsx';
import toast from 'react-hot-toast';

function titleCase(str = '') {
    return str
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function generateDummyAvailability(startMonth = dayjs().startOf('month')) {
    const end = startMonth.add(1, 'month').endOf('month');
    const availability = {};
    let d = startMonth.startOf('week');
    while (d.isBefore(end) || d.isSame(end, 'day')) {
        const weekday = d.day(); // 0 Sun - 6 Sat
        // Closed on Sundays
        if (weekday !== 0) {
            const hours = [];
            // Morning slots every 30min between 9:00 - 12:00
            for (let h = 9; h < 12; h++) {
                hours.push(`${String(h).padStart(2, '0')}:00`);
                hours.push(`${String(h).padStart(2, '0')}:30`);
            }
            // Afternoon sparse slots
            for (let h = 17; h <= 19; h++) {
                hours.push(`${String(h).padStart(2, '0')}:00`);
            }
            availability[d.format('YYYY-MM-DD')] = hours;
        }
        d = d.add(1, 'day');
    }
    return availability;
}

function ReservaAmenityPage() {
    const { amenity } = useParams();
    const [availability, setAvailability] = useState({});
    const [selected, setSelected] = useState(null);
    const display = useMemo(() => titleCase(decodeURIComponent(amenity || '')), [amenity]);

    useEffect(() => {
        let mounted = true;
        // Simulate async fetch to DB
        const timer = setTimeout(() => {
            if (!mounted) return;
            const data = generateDummyAvailability(dayjs().startOf('month'));
            setAvailability(data);
        }, 400);
        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [amenity]);

    return (
        <AppLayout>
            <PageLayout
                title={`Reservar ${display}`}
                description="Selecciona un horario disponible"
                backBtn
            >
                <div className="flex flex-col gap-4">
                    <ReservationCalendar
                        availability={availability}
                        amenityName={display}
                        onSelect={setSelected}
                        onCancelSelection={() => setSelected(null)}
                        onConfirm={(payload) => {
                            setSelected(payload);
                            toast.success(
                                `Reserva confirmada: ${display} el ${dayjs(payload.date).format('DD MMM YYYY')} a las ${payload.time} (${payload.timezone})`,
                            );
                        }}
                    />
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default ReservaAmenityPage;
