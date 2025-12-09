import { createClient } from '@supabase/supabase-js';

// Cloudflare Pages Function: /api/reservations
// Supports:
// - GET availability for an amenity considering rules and existing reservations
//   query: availability=1&condo_id&amenity_id&start=YYYY-MM-DD&days=30&user_id(optional)
//   or from/to ISO datetime range
// - POST: create reservation with validations
//   body: { condo_id, user_id, amenity_id, start_time (ISO), end_time (ISO)?, reservation_duration_minutes? }
//   status rule: if amenity.requires_payment => 'pending', else 'confirmed'

function minutesBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 60000);
}

function parseDateOnly(yyyyMmDd) {
    const [y, m, d] = String(yyyyMmDd || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt;
}

function toYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseTimeToMinutes(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':').map((v) => parseInt(v || '0', 10));
    return h * 60 + m;
}

function minutesToHHMM(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDow(date) {
    // 0..6, Sunday=0
    return date.getDay();
}

function addMinutes(date, mins) {
    const d = new Date(date.getTime());
    d.setMinutes(d.getMinutes() + mins);
    return d;
}

async function fetchAmenityAndRules(supabase, condo_id, amenity_id) {
    const [{ data: amenity, error: amenityError }, { data: rules, error: rulesError }] = await Promise.all([
        supabase.from('amenities').select('id, max_capacity, is_reservable, requires_payment, condo_id').eq('id', amenity_id).eq('condo_id', condo_id).single(),
        supabase.from('amenity_rules').select('amenity_id, day_of_week, open_time, close_time, slot_duration_minutes, min_lead_time_hours, max_lead_time_days, reservations_per_user_day, condo_id').eq('amenity_id', amenity_id).eq('condo_id', condo_id),
    ]);
    if (amenityError || !amenity) throw new Error(amenityError?.message || 'Amenity not found');
    if (rulesError) throw new Error(rulesError.message);
    return { amenity, rules: rules || [] };
}

function buildRuleMap(rules) {
    const byDow = new Map();
    for (const r of rules || []) byDow.set(Number(r.day_of_week), r);
    return byDow;
}

function withinLeadTimes(now, slotStart, rule) {
    const minLeadH = Number(rule.min_lead_time_hours || 0);
    const maxLeadD = Number(rule.max_lead_time_days || 365);
    const diffHours = Math.floor((slotStart.getTime() - now.getTime()) / 3600000);
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotDay0 = new Date(slotStart.getFullYear(), slotStart.getMonth(), slotStart.getDate());
    const diffDays = Math.round((slotDay0.getTime() - today0.getTime()) / 86400000);
    return diffHours >= minLeadH && diffDays <= maxLeadD;
}

function overlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const availabilityParam = url.searchParams.get('availability');
        if (!availabilityParam) {
            return Response.json({ success: false, error: 'Not implemented' }, { status: 400 });
        }
        const condo_id = url.searchParams.get('condo_id');
        const amenity_id = url.searchParams.get('amenity_id');
        const user_id = url.searchParams.get('user_id');
        const start = url.searchParams.get('start'); // YYYY-MM-DD
        const from = url.searchParams.get('from'); // ISO
        const to = url.searchParams.get('to'); // ISO
        const days = Number(url.searchParams.get('days') || 30);
        if (!condo_id || !amenity_id) {
            return Response.json({ success: false, error: 'condo_id and amenity_id are required' }, { status: 400 });
        }
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);
        const { amenity, rules } = await fetchAmenityAndRules(supabase, condo_id, amenity_id);
        if (!amenity.is_reservable) {
            return Response.json({ success: true, availability: {} });
        }
        const byDow = buildRuleMap(rules);
        // Determine range
        let rangeFrom, rangeTo;
        if (from && to) {
            rangeFrom = new Date(from);
            rangeTo = new Date(to);
        } else {
            const startDate = start ? parseDateOnly(start) : new Date();
            const startLocal = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            rangeFrom = startLocal;
            rangeTo = new Date(startLocal.getTime());
            rangeTo.setDate(rangeTo.getDate() + (isFinite(days) ? days : 30));
        }
        // Fetch existing reservations within range for that amenity
        const { data: reservations, error: resErr } = await supabase
            .from('reservations')
            .select('id, start_time, end_time, status, user_id')
            .eq('condo_id', condo_id)
            .eq('amenity_id', amenity_id)
            .neq('status', 'cancelled')
            .gte('start_time', rangeFrom.toISOString())
            .lt('start_time', rangeTo.toISOString());
        if (resErr) throw new Error(resErr.message);

        // Build availability
        const availability = {};
        const userLimitByDate = {};
        const now = new Date();
        const maxCap = Number(amenity.max_capacity || 1);

        // Pre-group reservations by date for quicker check
        const resByDate = new Map();
        for (const r of reservations || []) {
            const d = new Date(r.start_time);
            const key = toYmd(d);
            if (!resByDate.has(key)) resByDate.set(key, []);
            resByDate.get(key).push(r);
        }

        const cursor = new Date(rangeFrom.getTime());
        while (cursor < rangeTo) {
            const dow = getDow(cursor);
            const rule = byDow.get(dow);
            if (rule) {
                const openM = parseTimeToMinutes(String(rule.open_time).slice(0, 5));
                const closeM = parseTimeToMinutes(String(rule.close_time).slice(0, 5));
                const step = Number(rule.slot_duration_minutes || 60);
                const key = toYmd(cursor);
                const dayReservations = resByDate.get(key) || [];

                // Check user's daily limit once per day and mark, but do not hide slots
                if (user_id && Number(rule.reservations_per_user_day || 0) > 0) {
                    let userCount = 0;
                    for (const r of dayReservations) {
                        if (String(r.user_id) === String(user_id)) userCount += 1;
                    }
                    if (userCount >= Number(rule.reservations_per_user_day)) {
                        userLimitByDate[key] = true;
                    }
                }

                const slots = [];
                for (let t = openM; t + step <= closeM; t += step) {
                    const startDt = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), Math.floor(t / 60), t % 60, 0, 0);
                    const endDt = addMinutes(startDt, step);
                    // lead times
                    if (!withinLeadTimes(now, startDt, rule)) continue;
                    // capacity: count overlaps in dayReservations
                    let count = 0;
                    for (const r of dayReservations) {
                        const rs = new Date(r.start_time);
                        const re = new Date(r.end_time);
                        if (overlap(startDt, endDt, rs, re)) count += 1;
                    }
                    if (count >= maxCap) continue;
                    // Note: we no longer hide slots when user is at daily limit; frontend will disable them.
                    slots.push(minutesToHHMM(t));
                }
                if (slots.length > 0) availability[key] = slots;
            }
            // next day
            cursor.setDate(cursor.getDate() + 1);
        }

        return Response.json({ success: true, availability, userLimitByDate });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const {
            condo_id,
            user_id,
            amenity_id,
            start_time,
            end_time: endTimeInput,
            reservation_duration_minutes,
        } = body || {};

        if (!condo_id || !user_id || !amenity_id || !start_time) {
            return Response.json(
                { success: false, error: 'condo_id, user_id, amenity_id, start_time are required' },
                { status: 400 },
            );
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

        // Fetch amenity and rules
        const { amenity, rules } = await fetchAmenityAndRules(supabase, condo_id, amenity_id);
        if (!amenity.is_reservable) {
            return Response.json({ success: false, error: 'Amenity is not reservable' }, { status: 400 });
        }

        // Determine rule for the day
        const start = new Date(start_time);
        if (isNaN(start.getTime())) {
            return Response.json(
                { success: false, error: 'start_time must be a valid ISO date string' },
                { status: 400 },
            );
        }
        const dow = getDow(start);
        const rule = buildRuleMap(rules).get(dow);
        if (!rule) {
            return Response.json({ success: false, error: 'No rule for selected day' }, { status: 400 });
        }

        const step = Number(rule.slot_duration_minutes || reservation_duration_minutes || 60);

        // Compute/validate end_time
        let end_time = endTimeInput;
        if (!end_time) {
            const end = addMinutes(start, step);
            end_time = end.toISOString();
        }
        const end = new Date(end_time);
        if (!(end > start)) {
            return Response.json({ success: false, error: 'end_time must be after start_time' }, { status: 400 });
        }

        // Validate within open/close
        const openM = parseTimeToMinutes(String(rule.open_time).slice(0, 5));
        const closeM = parseTimeToMinutes(String(rule.close_time).slice(0, 5));
        const startM = start.getHours() * 60 + start.getMinutes();
        const endM = end.getHours() * 60 + end.getMinutes();
        if (startM < openM || endM > closeM) {
            return Response.json({ success: false, error: 'Time outside opening hours' }, { status: 400 });
        }

        // Validate lead times
        if (!withinLeadTimes(new Date(), start, rule)) {
            return Response.json({ success: false, error: 'Does not meet lead-time constraints' }, { status: 400 });
        }

        // Validate capacity overlap in the same slot window
        const { data: dayReservations, error: resErr } = await supabase
            .from('reservations')
            .select('id, start_time, end_time, status, user_id')
            .eq('condo_id', condo_id)
            .eq('amenity_id', amenity_id)
            .neq('status', 'cancelled')
            .gte('start_time', new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString())
            .lt('start_time', new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).toISOString());
        if (resErr) {
            return Response.json({ success: false, error: resErr.message }, { status: 500 });
        }
        let overlapping = 0;
        let userCount = 0;
        for (const r of dayReservations || []) {
            const rs = new Date(r.start_time);
            const re = new Date(r.end_time);
            if (overlap(start, end, rs, re)) overlapping += 1;
            if (String(r.user_id) === String(user_id)) userCount += 1;
        }
        const maxCap = Number(amenity.max_capacity || 1);
        if (overlapping >= maxCap) {
            return Response.json({ success: false, error: 'Slot full' }, { status: 409 });
        }

        // Per-user-per-day limit
        const perDay = Number(rule.reservations_per_user_day || 0);
        if (perDay > 0 && userCount >= perDay) {
            return Response.json({ success: false, error: 'Daily reservation limit reached' }, { status: 409 });
        }

        // Determine status based on amenity.requires_payment
        const requiresPayment = !!amenity.requires_payment;
        const status = requiresPayment ? 'pending' : 'confirmed';

        const insertPayload = {
            condo_id,
            user_id,
            amenity_id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            reservation_duration_minutes: reservation_duration_minutes || minutesBetween(start, end),
            status,
        };

        const { data, error } = await supabase
            .from('reservations')
            .insert(insertPayload)
            .select('*')
            .single();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, data });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
