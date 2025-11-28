import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

// ========== AMENITIES ==========

async function fetchAmenities({ condo_id, onlyReservable = false }) {
    let query = supabaseClient.from('amenities').select('*').eq('condo_id', condo_id);
    if (onlyReservable) query = query.eq('is_reservable', true);
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error('Failed to fetch amenities');
    return data;
}

export function useAmenitiesList(currentWorkspace, { onlyReservable = false } = {}) {
    return useQuery({
        queryKey: ['amenities', currentWorkspace?.condo_id, { onlyReservable }],
        queryFn: () =>
            fetchAmenities({
                condo_id: currentWorkspace?.condo_id,
                onlyReservable,
            }),
        enabled: !!currentWorkspace?.condo_id,
        staleTime: 1000 * 60 * 5,
    });
}

async function fetchAmenity({ condo_id, name }) {
    // Find by name case-insensitively
    const { data, error } = await supabaseClient
        .from('amenities')
        .select('*')
        .eq('condo_id', condo_id)
        .ilike('name', name)
        .maybeSingle();
    if (error) throw new Error('Failed to fetch amenity');
    return data;
}

export function useAmenity(currentWorkspace, { name } = {}) {
    return useQuery({
        queryKey: ['amenity', currentWorkspace?.condo_id, name?.toLowerCase()],
        queryFn: () =>
            fetchAmenity({
                condo_id: currentWorkspace?.condo_id,
                name,
            }),
        enabled: !!currentWorkspace?.condo_id && !!name,
        staleTime: 1000 * 60 * 5,
    });
}

async function createAmenity(amenity) {
    const { data, error } = await supabaseClient
        .from('amenities')
        .insert(amenity)
        .select()
        .single();
    if (error) throw new Error('Failed to create amenity');
    return data;
}

export function useCreateAmenity(currentWorkspace) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (partial) => createAmenity({ ...partial, condo_id: currentWorkspace.condo_id }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['amenities', currentWorkspace?.condo_id] });
        },
    });
}

async function updateAmenity({ id, updates }) {
    const { data, error } = await supabaseClient
        .from('amenities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error('Failed to update amenity');
    return data;
}

export function useUpdateAmenity(currentWorkspace) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updateAmenity,
        onSuccess: (updated) => {
            qc.invalidateQueries({ queryKey: ['amenities', currentWorkspace?.condo_id] });
            qc.invalidateQueries({
                queryKey: ['amenity', currentWorkspace?.condo_id, updated?.name?.toLowerCase?.()],
            });
        },
    });
}

async function deleteAmenity({ id }) {
    const { error } = await supabaseClient.from('amenities').delete().eq('id', id);
    if (error) throw new Error('Failed to delete amenity');
}

export function useDeleteAmenity(currentWorkspace) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteAmenity,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['amenities', currentWorkspace?.condo_id] });
        },
    });
}

// ========== AMENITY RULES ==========

async function fetchAmenityRules({ condo_id, amenity_id }) {
    const { data, error } = await supabaseClient
        .from('amenity_rules')
        .select('*')
        .eq('condo_id', condo_id)
        .eq('amenity_id', amenity_id)
        .order('day_of_week', { ascending: true });
    if (error) throw new Error('Failed to fetch amenity rules');
    return data || [];
}

export function useAmenityRules(currentWorkspace, { amenity_id } = {}) {
    return useQuery({
        queryKey: ['amenity_rules', currentWorkspace?.condo_id, amenity_id],
        queryFn: () => fetchAmenityRules({ condo_id: currentWorkspace?.condo_id, amenity_id }),
        enabled: !!currentWorkspace?.condo_id && !!amenity_id,
        staleTime: 1000 * 60 * 5,
    });
}

async function upsertAmenityRules({ rules }) {
    const { data, error } = await supabaseClient.from('amenity_rules').upsert(rules).select();
    if (error) throw new Error('Failed to upsert amenity rules');
    return data;
}

export function useUpsertAmenityRules(currentWorkspace) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: upsertAmenityRules,
        onSuccess: (res) => {
            // Invalidate by amenity ids present in rules
            const ids = Array.from(new Set(res.map((r) => r.amenity_id)));
            ids.forEach((id) =>
                qc.invalidateQueries({
                    queryKey: ['amenity_rules', currentWorkspace?.condo_id, id],
                }),
            );
        },
    });
}
