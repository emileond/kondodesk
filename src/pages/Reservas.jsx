import PageLayout from '../components/layout/PageLayout.jsx';
import AmenityCard from '../components/amenidades/AmenityCard.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace';
import { useAmenitiesList } from '../hooks/react-query/amenities/useAmenities';
import { Skeleton } from '@heroui/react';

function ReservasPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const {
        data: amenities = [],
        isPending,
        isError,
    } = useAmenitiesList(currentWorkspace, {
        onlyReservable: true,
    });

    return (
        <AppLayout>
            <PageLayout title="Amenidades" backBtn>
                {isPending && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="rounded-xl h-48 w-full" />
                        ))}
                    </div>
                )}
                {isError && (
                    <p className="text-sm text-danger">
                        No se pudieron cargar las amenidades. Intenta más tarde.
                    </p>
                )}
                {!isPending && !isError && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {amenities.length === 0 && (
                            <p className="col-span-full text-sm text-default-500">
                                No hay amenidades reservables configuradas.
                            </p>
                        )}
                        {amenities.map((a) => (
                            <AmenityCard key={a.id} amenity={a} />
                        ))}
                    </div>
                )}
            </PageLayout>
        </AppLayout>
    );
}

export default ReservasPage;
