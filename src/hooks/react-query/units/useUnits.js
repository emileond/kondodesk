import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ky from 'ky';
import { supabaseClient } from '../../../lib/supabase';

async function fetchUnits({ condo_id, unit_ids, includeAll = false }) {
    if (!condo_id) return [];
    let query = supabaseClient.from('units').select('id, address, condo_id').eq('condo_id', condo_id);
    if (!includeAll) {
        if (!Array.isArray(unit_ids) || unit_ids.length === 0) return [];
        query = query.in('id', unit_ids);
    }
    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch units');
    return data || [];
}

const api = ky.create({ prefixUrl: '/api' });

async function createUnit({ condo_id, address }) {
    if (!condo_id || !address) throw new Error('condo_id and address are required');
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) throw new Error('Missing session');
    const res = await api.post('units', { json: { condo_id, address, session } }).json();
    if (!res?.success) throw new Error(res?.error || 'Failed to create unit');
    return res.data;
}

async function fetchCondoMemberUnitIds({ condo_id, user_id }) {
    if (!condo_id || !user_id) return [];
    const { data, error } = await supabaseClient
        .from('condo_members')
        .select('unit_ids')
        .eq('condo_id', condo_id)
        .eq('user_id', user_id)
        .maybeSingle();
    if (error) throw new Error('Failed to fetch condo member units');
    return Array.isArray(data?.unit_ids) ? data.unit_ids : [];
}

export function useCondoMemberUnitIds(currentWorkspace, user) {
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    return useQuery({
        queryKey: ['condoMemberUnits', condoId, user?.id],
        queryFn: () => fetchCondoMemberUnitIds({ condo_id: condoId, user_id: user?.id }),
        enabled: !!condoId && !!user?.id,
        staleTime: 1000 * 60 * 5,
    });
}

export function useUnitsList(currentWorkspace, user, options = {}) {
    const { data: memberUnitIds = [] } = useCondoMemberUnitIds(currentWorkspace, user);
    const unitIds =
        Array.isArray(options.unit_ids) && options.unit_ids.length > 0
            ? options.unit_ids
            : Array.isArray(memberUnitIds)
              ? memberUnitIds
              : [];
    const includeAll = options.includeAll === true;
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;

    return useQuery({
        queryKey: [
            'units',
            condoId,
            includeAll,
            user?.id || null,
            unitIds.join(',') || null,
        ],
        queryFn: () => fetchUnits({ condo_id: condoId, unit_ids: unitIds, includeAll }),
        enabled: !!condoId && (includeAll || (!!user && unitIds.length > 0)),
        staleTime: 1000 * 60 * 5,
    });
}

export function useCreateUnit(currentWorkspace) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ address, condo_id }) =>
            createUnit({ condo_id: condo_id || currentWorkspace?.condo_id, address }),
        onSuccess: (unit) => {
            qc.invalidateQueries({ queryKey: ['units', unit?.condo_id] });
        },
    });
}
