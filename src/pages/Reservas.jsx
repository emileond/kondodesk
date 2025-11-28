import PageLayout from '../components/layout/PageLayout.jsx';
import AmenityCard from '../components/amenidades/AmenityCard.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';

const AMENITIES = ['gym', 'cancha padel', 'terraza'];

function ReservasPage() {
    return (
        <AppLayout>
            <PageLayout title="Amenidades" description="Reserva amenidades de tu workspace" backBtn>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {AMENITIES.map((a) => (
                        <AmenityCard key={a} amenity={a} />
                    ))}
                </div>
            </PageLayout>
        </AppLayout>
    );
}

export default ReservasPage;
