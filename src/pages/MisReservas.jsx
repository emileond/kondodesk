import { Card, CardBody, CardHeader, Button, Select, SelectItem } from '@heroui/react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import ReservationCard from '../components/reservations/ReservationCard.jsx';
import ReservationCalendar from '../components/amenidades/ReservationCalendar.jsx';

function EmptyState({ title, description, cta }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <div className="text-large font-medium text-default-600">{title}</div>
            {description && (
                <div className="text-small text-default-500 max-w-md">{description}</div>
            )}
            {cta}
        </div>
    );
}

import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useReservationsList } from '../hooks/react-query/reservations/useReservations.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { useCondoMemberUnitIds, useUnitsList } from '../hooks/react-query/units/useUnits.js';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../lib/supabase.js';
import { useAmenitiesList } from '../hooks/react-query/amenities/useAmenities.js';

function MisReservasPage() {
    const [currentWorkspace] = useCurrentWorkspace();
    const { data: currentUser } = useUser();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    const { data: currentMember } = useQuery({
        queryKey: ['condoMember', condoId, currentUser?.id],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('condo_members')
                .select('role')
                .eq('condo_id', condoId)
                .eq('user_id', currentUser?.id)
                .maybeSingle();
            if (error) throw new Error('Failed to fetch user role');
            return data;
        },
        enabled: !!condoId && !!currentUser?.id,
        staleTime: 1000 * 60 * 5,
    });
    const isAdmin = currentMember?.role === 'admin';
    const { data: unitIds = [] } = useCondoMemberUnitIds(currentWorkspace, currentUser);
    const [selectedAmenity, setSelectedAmenity] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');

    const fromISO = useMemo(() => dayjs().startOf('day').toISOString(), []);

    const { data: reservations = [], isLoading } = useReservationsList({
        condo_id: condoId,
        is_admin: isAdmin,
        unit_ids: isAdmin ? undefined : unitIds,
        from: isAdmin ? undefined : fromISO,
        amenity_id: isAdmin && selectedAmenity !== 'all' ? selectedAmenity : undefined,
        status: isAdmin && selectedStatus !== 'all' ? selectedStatus : undefined,
    });

    const upcomingReservations = reservations;

    const { data: units = [] } = useUnitsList(currentWorkspace, currentUser, {
        includeAll: isAdmin,
    });
    const { data: amenities = [] } = useAmenitiesList(currentWorkspace, {
        onlyReservable: true,
    });

    const unitLabelById = useMemo(
        () => new Map((units || []).map((unit) => [String(unit.id), unit.address])),
        [units],
    );

    const reservationsByDate = useMemo(() => {
        const map = {};
        for (const r of reservations || []) {
            const status = String(r?.status || '').toLowerCase();
            const includeCancelled = isAdmin && selectedStatus === 'cancelled';
            if (!includeCancelled && (status === 'cancelled' || status === 'canceled')) continue;
            const dateKey = r?.start_time ? dayjs(r.start_time).format('YYYY-MM-DD') : null;
            if (!dateKey) continue;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(r);
        }
        return map;
    }, [JSON.stringify(reservations), isAdmin, selectedStatus]);

    const amenityOptions = useMemo(
        () =>
            (amenities || []).map((amenity) => ({
                key: String(amenity.id),
                label: amenity.name,
            })),
        [amenities],
    );
    const statusOptions = [
        { key: 'confirmed', label: 'Confirmada' },
        { key: 'pending', label: 'Pendiente' },
        { key: 'cancelled', label: 'Cancelada' },
    ];

    return (
        <AppLayout>
            {isAdmin ? (
                <PageLayout
                    title="Reservas"
                    description="Calendario de reservas del condominio"
                    maxW="6xl"
                    backBtn
                >
                    <div>
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <span className="text-default-600 font-semibold text-sm">Filtros</span>
                            <Select
                                variant="bordered"
                                label="Amenidad"
                                selectedKeys={[selectedAmenity]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] || 'all';
                                    setSelectedAmenity(String(value));
                                }}
                                size="sm"
                            >
                                <SelectItem key="all" value="all">
                                    Todas
                                </SelectItem>
                                {amenityOptions.map((option) => (
                                    <SelectItem key={option.key} value={option.key}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </Select>
                            <Select
                                variant="bordered"
                                size="sm"
                                label="Estado"
                                selectedKeys={[selectedStatus]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] || 'all';
                                    setSelectedStatus(String(value));
                                }}
                            >
                                <SelectItem key="all" value="all">
                                    Todos
                                </SelectItem>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.key} value={option.key}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                        {isLoading ? (
                            <div className="text-sm text-default-500">Cargando…</div>
                        ) : (
                            <ReservationCalendar
                                availability={{}}
                                userLimitByDate={{}}
                                reservationsByDate={reservationsByDate}
                                allowSelection={false}
                                showAvailability={false}
                                showReservationsAlways
                                unitLabelById={unitLabelById}
                                reservationCardProps={{
                                    canManage: isAdmin,
                                    condoId,
                                }}
                            />
                        )}
                    </div>
                </PageLayout>
            ) : (
                <PageLayout title="Reservas" description="Tus próximas reservas" maxW="4xl" backBtn>
                    <Card>
                        <CardHeader className="text-default-600 font-semibold">
                            Próximas reservas
                        </CardHeader>
                        <CardBody>
                            {isLoading ? (
                                <div className="text-sm text-default-500">Cargando…</div>
                            ) : upcomingReservations.length > 0 ? (
                                <ul className="flex flex-col gap-3">
                                    {upcomingReservations.map((r, i) => (
                                        <li key={r?.id || i}>
                                            <ReservationCard
                                                reservation={r}
                                                amenityName={r?.amenity?.name}
                                                unitLabel={
                                                    unitLabelById.get(String(r?.unit_id)) || ''
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState
                                    title="Aún no tienes reservas"
                                    description="Reserva amenidades como el gimnasio, la terraza o la cancha de pádel."
                                    cta={
                                        <Button
                                            as={Link}
                                            to="/amenidades"
                                            color="primary"
                                            className="font-medium"
                                        >
                                            Reservar amenidades
                                        </Button>
                                    }
                                />
                            )}
                        </CardBody>
                    </Card>
                </PageLayout>
            )}
        </AppLayout>
    );
}

export default MisReservasPage;
