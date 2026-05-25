import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ky from 'ky';
import { supabaseClient } from '../../../lib/supabase';

async function fetchUnits({ condo_id, unit_ids, includeAll = false }) {
    if (!condo_id) return [];
    let query = supabaseClient
        .from('units')
        .select('id, address, status, condo_id')
        .eq('condo_id', condo_id);
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

    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (session?.access_token) {
        try {
            const res = await api
                .get(`units/member?condo_id=${encodeURIComponent(String(condo_id))}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })
                .json();
            if (res?.success) {
                return [...new Set((res?.data?.unit_ids || []).filter(Boolean))];
            }
        } catch {
            // Fallback to direct client queries when API route is unavailable.
        }
    }

    const { data: members, error: membersError } = await supabaseClient
        .from('condo_members')
        .select('id')
        .eq('condo_id', condo_id)
        .eq('user_id', user_id)
        .eq('status', 'active');

    if (membersError) throw new Error('Failed to fetch condo member');

    const memberIds = (members || [])
        .map((member) => member?.id)
        .filter((memberId) => memberId != null);

    if (memberIds.length === 0) return [];

    const { data: unitMembers, error: unitMembersError } = await supabaseClient
        .from('unit_members')
        .select('unit_id')
        .in('condo_member_id', memberIds);

    if (unitMembersError) throw new Error('Failed to fetch unit memberships');

    return [...new Set((unitMembers || []).map((item) => item?.unit_id).filter(Boolean))];
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
        queryKey: ['units', condoId, includeAll, user?.id || null, unitIds.join(',') || null],
        queryFn: () => fetchUnits({ condo_id: condoId, unit_ids: unitIds, includeAll }),
        enabled: !!condoId && (includeAll || (!!user && unitIds.length > 0)),
        staleTime: 1000 * 60 * 5,
    });
}

export function useCreateUnit(currentWorkspace) {
    const qc = useQueryClient();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    return useMutation({
        mutationFn: ({ address, condo_id }) =>
            createUnit({ condo_id: condo_id || condoId, address }),
        onSuccess: (unit) => {
            qc.invalidateQueries({ queryKey: ['units'] });
            qc.invalidateQueries({ queryKey: ['units', unit?.condo_id || condoId] });
        },
    });
}
