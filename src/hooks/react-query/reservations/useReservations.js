import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ky from 'ky';
import { supabaseClient } from '../../../lib/supabase';

// Base client for API (used for creating reservations and availability)
const api = ky.create({ prefixUrl: '/api' });

export async function fetchReservations(params) {
    const { condo_id, user_id, is_admin, amenity_id, status, date, from, to, limit } =
        params || {};

    if (!condo_id) return [];

    let query = supabaseClient.from('reservations').select('*').eq('condo_id', condo_id);

    const admin = is_admin === true || is_admin === 'true' || is_admin === 1 || is_admin === '1';
    if (!admin) {
        if (!user_id) return [];
        query = query.eq('user_id', user_id);
    } else if (user_id) {
        query = query.eq('user_id', user_id);
    }

    if (amenity_id) query = query.eq('amenity_id', amenity_id);
    if (status) query = query.eq('status', status);

    // Handle date or from/to
    let rangeFrom = from;
    let rangeTo = to;
    if (date && !from && !to) {
        const day = new Date(date);
        if (!isNaN(day.getTime())) {
            const start = new Date(day);
            start.setHours(0, 0, 0, 0);
            const end = new Date(day);
            end.setHours(23, 59, 59, 999);
            rangeFrom = start.toISOString();
            rangeTo = end.toISOString();
        }
    }
    if (rangeFrom) query = query.gte('start_time', rangeFrom);
    if (rangeTo) query = query.lte('start_time', rangeTo);

    query = query.order('start_time', { ascending: true });
    if (limit && Number(limit)) query = query.limit(Number(limit));

    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch reservations');
    const reservations = data || [];

    if (!reservations.length) return reservations;

    // Fetch related amenities in one call and merge
    const amenityIds = Array.from(
        new Set(
            reservations
                .map((r) => r?.amenity_id)
                .filter((id) => id !== null && id !== undefined)
        )
    );

    if (amenityIds.length === 0) return reservations;

    const { data: amenities, error: amenitiesError } = await supabaseClient
        .from('amenities')
        .select('id, name, requires_payment, condo_id')
        .in('id', amenityIds)
        .eq('condo_id', condo_id);

    if (amenitiesError) {
        // If amenities fetch fails, still return reservations without amenity info
        return reservations;
    }

    const map = new Map((amenities || []).map((a) => [a.id, a]));

    return reservations.map((r) => ({ ...r, amenity: map.get(r.amenity_id) || null }));
}

export function useReservationsList(filters = {}) {
    const { condo_id, user_id, is_admin, amenity_id, status, date, from, to, limit } =
        filters || {};

    const enabled = !!condo_id && (!!user_id || String(is_admin) === 'true');

    return useQuery({
        queryKey: [
            'reservations',
            condo_id,
            user_id,
            String(is_admin) === 'true',
            amenity_id || null,
            status || null,
            date || null,
            from || null,
            to || null,
            limit || null,
        ],
        queryFn: () => fetchReservations(filters),
        enabled,
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
        keepPreviousData: true,
    });
}

async function createReservation(payload) {
    const res = await api.post('reservations', { json: payload }).json();
    if (!res?.success) throw new Error(res?.error || 'Failed to create reservation');
    return res.data;
}

export async function fetchAmenityAvailability(params) {
    const { condo_id, amenity_id, user_id, start, days, from, to } = params || {};
    const searchParams = new URLSearchParams();
    searchParams.set('availability', '1');
    if (condo_id) searchParams.set('condo_id', condo_id);
    if (amenity_id) searchParams.set('amenity_id', amenity_id);
    if (user_id) searchParams.set('user_id', user_id);
    if (start) searchParams.set('start', start);
    if (Number.isFinite(Number(days))) searchParams.set('days', String(days));
    if (from) searchParams.set('from', from);
    if (to) searchParams.set('to', to);

    const res = await api.get(`reservations?${searchParams.toString()}`).json();
    if (!res?.success) throw new Error(res?.error || 'Failed to fetch availability');
    return {
        availability: res.availability || {},
        userLimitByDate: res.userLimitByDate || {},
    };
}

export function useAmenityAvailability(filters = {}) {
    const { condo_id, amenity_id, user_id, start, days = 30, from, to } = filters || {};
    const enabled = !!condo_id && !!amenity_id;
    return useQuery({
        queryKey: ['availability', condo_id, amenity_id, user_id || null, start || null, days, from || null, to || null],
        queryFn: () => fetchAmenityAvailability({ condo_id, amenity_id, user_id, start, days, from, to }),
        enabled,
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
        keepPreviousData: true,
    });
}

export function useCreateReservation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createReservation,
        onSuccess: (_data, variables) => {
            // Invalidate relevant lists for this condo and user
            const condo_id = variables?.condo_id;
            const user_id = variables?.user_id;
            const amenity_id = variables?.amenity_id;
            // Invalidate any queries whose key starts with ['reservations']
            qc.invalidateQueries({ predicate: ({ queryKey }) => queryKey?.[0] === 'reservations' });
            if (condo_id) {
                qc.invalidateQueries({ queryKey: ['reservations', condo_id, user_id] });
            }
            if (condo_id && amenity_id) {
                qc.invalidateQueries({
                    predicate: ({ queryKey }) =>
                        queryKey?.[0] === 'availability' && queryKey?.[1] === condo_id && queryKey?.[2] === amenity_id,
                });
            }
        },
    });
}
