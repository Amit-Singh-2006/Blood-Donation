/**
 * Rules of the LifeLink donor network: who is alerted for a blood request and
 * in what order, and how alerts escalate when nobody answers. Ported from the
 * n8n workflows that ran the network until October 2026. Everything in
 * src/network except store.ts and engine.ts is pure: the engine loads rows,
 * calls these functions and saves what they return.
 */
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { BLOOD_GROUPS, DEFERRAL_DAYS, compatibleDonorGroups } from '../utils/bloodCompatibility';

export type Urgency = 'Normal' | 'Urgent' | 'Emergency';
export type RequestStatus = 'Open' | 'Fulfilled' | 'Completed' | 'Exhausted' | 'Cancelled';
export type MatchStatus =
    | 'notified' | 'queued' | 'accepted' | 'declined' | 'donated' | 'no_show'
    | 'expired' | 'skipped' | 'not_needed' | 'superseded';
export type Channel = 'push' | 'sms' | 'whatsapp' | 'in_app';

/** A donor in the network registry. The phone number is their identity. */
export interface NetDonor {
    id: number;
    name: string;
    phone: string;
    blood_group: string;
    gender: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    available: boolean;
    last_donation_date: string | null; // YYYY-MM-DD
    total_donations: number;
    preferred_channel: string;
    fcm_token: string | null;
    xp_points: number;
    committed_until: string | null; // ISO time
    source: string;
}

export interface NetRequest {
    id: number;
    hospital_name: string;
    hospital_city: string;
    hospital_contact: string | null;
    patient_ref: string | null;
    blood_group: string;
    units_required: number;
    urgency: Urgency;
    latitude: number | null;
    longitude: number | null;
    required_by: string | null;
    status: RequestStatus;
    units_confirmed: number;
    units_donated: number;
    compatible_donors: number;
    donors_notified: number;
    wave_size: number;
    escalation_minutes: number;
    escalation_rounds: number;
    status_token: string;
    hospital_token: string;
    first_accept_at: string | null;
    fulfilled_at: string | null;
    closed_reason: string | null;
    closed_at: string | null;
    next_check_at: string | null;
    created_at: string;
    updated_at: string;
}

/** One donor ranked for one request, and where that alert stands. */
export interface NetMatch {
    id: number;
    request_id: number;
    donor_id: number | null; // null once the donor left the network
    donor_blood_group: string;
    request_blood_group: string;
    rank: number;
    distance_km: number | null;
    exact_match: boolean;
    status: MatchStatus;
    response_token: string;
    channel: Channel;
    contact: string | null;
    hospital_name: string;
    hospital_city: string;
    urgency: Urgency;
    units_required: number;
    notified_at: string | null;
    responded_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface FieldError {
    path: string;
    message: string;
}

const DAY = 86400000;
export const HOURS_COMMITTED = 24;
export const XP_PER_DONATION = 10;
/** Escalation gives up this many hours after the request was raised. */
export const MAX_HOURS = 12;
export const RADIUS_KM = 80;
const BAND_KM = 15;
const CITY_ESTIMATE_KM = 15;

export const URGENCY_TO_DB: Record<string, Urgency> = {
    standard: 'Normal', low: 'Normal', medium: 'Normal', Normal: 'Normal',
    high: 'Urgent', Urgent: 'Urgent',
    critical: 'Emergency', Emergency: 'Emergency',
};
/** Minutes to wait for replies before alerting the next ranked donors. */
export const ESCALATION_MINUTES: Record<Urgency, number> = { Emergency: 10, Urgent: 20, Normal: 60 };

/** Not everyone answers, so more donors are alerted up front for emergencies. */
export const waveSize = (units: number, urgency: string) =>
    urgency === 'Emergency' ? Math.min(10, Math.max(3, units * 3))
        : urgency === 'Urgent' ? Math.min(8, Math.max(2, units * 2))
            : Math.min(6, Math.max(2, units + 1));

/** A mobile number with country code; bare 10-digit numbers are Indian. */
export const normalizePhone = (value: unknown): string | null => {
    const s = String(value ?? '').replace(/[\s()-]/g, '');
    if (/^\+\d{10,15}$/.test(s)) return s;
    if (/^\d{10}$/.test(s)) return '+91' + s;
    return null;
};

export const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const filled = (v: unknown) => v !== undefined && v !== null && v !== '';
export const validCoord = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
export const article = (group: string) => (/^[AO]/.test(group) ? 'an' : 'a');
export const firstName = (name: unknown, fallback: string) => String(name ?? '').trim().split(/\s+/)[0] || fallback;
export const isBloodGroup = (v: unknown): v is string => typeof v === 'string' && (BLOOD_GROUPS as readonly string[]).includes(v);

/** Unknown gender uses the longer rest period. */
export const deferralDays = (gender: string | null | undefined): number =>
    (DEFERRAL_DAYS as Record<string, number>)[gender ?? ''] ?? DEFERRAL_DAYS.female;

/** When the donor may give again (ms), or null if they never donated. */
export const eligibleFromMs = (d: Pick<NetDonor, 'last_donation_date' | 'gender'>): number | null =>
    d.last_donation_date ? Date.parse(d.last_donation_date + 'T00:00:00Z') + deferralDays(d.gender) * DAY : null;

export const eligibleFromDate = (d: Pick<NetDonor, 'last_donation_date' | 'gender'>): string | null => {
    const from = eligibleFromMs(d);
    return from === null ? null : new Date(from).toISOString().slice(0, 10);
};

/** Available, past the rest period and not already booked for another request. */
export const eligibleNow = (d: NetDonor | null | undefined, now: number) => {
    if (!d || d.available !== true) return false;
    if (d.committed_until && Date.parse(d.committed_until) > now) return false;
    const from = eligibleFromMs(d);
    return from === null || from <= now;
};

export const channelFor = (d: Pick<NetDonor, 'preferred_channel' | 'fcm_token' | 'phone'>): Channel => {
    if (d.preferred_channel === 'push' && d.fcm_token) return 'push';
    if (['sms', 'whatsapp', 'push'].includes(d.preferred_channel) && d.phone) {
        return d.preferred_channel === 'push' ? 'sms' : (d.preferred_channel as Channel);
    }
    return 'in_app';
};

export const contactFor = (d: Pick<NetDonor, 'fcm_token' | 'phone'>, channel: Channel) =>
    channel === 'push' ? d.fcm_token : channel === 'in_app' ? null : d.phone;

const toRad = (deg: number) => (deg * Math.PI) / 180;
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const PASS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/**
 * Donation pass shown at the hospital gate. It is derived from the donor's
 * private link token, so it proves who said YES without revealing the token.
 */
export const passCode = (token: string) => {
    const h = createHash('sha256').update(String(token) + ':lifelink-pass').digest();
    let s = '';
    for (let i = 0; i < 8; i++) s += PASS_ALPHABET[h[i]! % PASS_ALPHABET.length];
    return 'LP-' + s.slice(0, 4) + '-' + s.slice(4);
};

/** Constant-time comparison of two link tokens. */
export const sameToken = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a || !b || a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

// One-tap links. `base` is the public address of the network API, e.g.
// https://blood-donation-backend-sepia.vercel.app/network
export const donorLink = (base: string, m: Pick<NetMatch, 'id' | 'response_token'>, action: 'accept' | 'decline') =>
    `${base}/donor-response?m=${m.id}&t=${m.response_token}&a=${action}`;
export const hospitalLink = (base: string, matchId: number, hospitalToken: string, action: 'donated' | 'no_show') =>
    `${base}/donor-response?m=${matchId}&h=${hospitalToken}&a=${action}`;
export const cancelLink = (base: string, req: Pick<NetRequest, 'id' | 'hospital_token'>) =>
    `${base}/donor-response?r=${req.id}&h=${req.hospital_token}&a=cancel`;
export const trackingLink = (base: string, token: string) => `${base}/request-status?token=${token}`;

// ── Request initiation ────────────────────────────────────────────────────

export interface NewRequest {
    hospital_name: string;
    hospital_city: string;
    hospital_contact: string | null;
    patient_ref: string | null;
    blood_group: string;
    units_required: number;
    urgency: Urgency;
    latitude: number | null;
    longitude: number | null;
    required_by: string | null;
    escalation_minutes: number;
    wave_size: number;
    status_token: string;
    hospital_token: string;
}

/** Same rules as schemas/hospitalSchemas.ts, plus the dispatch settings escalation uses. */
export const validateDispatch = (body: Record<string, unknown>, now = Date.now()): { errors: FieldError[]; request: NewRequest | null } => {
    const errors: FieldError[] = [];

    const hospitalName = text(body.hospital_name);
    if (hospitalName.length < 2 || hospitalName.length > 200) errors.push({ path: 'hospital_name', message: 'Hospital name is required (2-200 characters)' });
    const hospitalCity = text(body.hospital_city);
    if (hospitalCity.length < 2 || hospitalCity.length > 100) errors.push({ path: 'hospital_city', message: 'Hospital city is required (2-100 characters)' });

    let hospitalContact: string | null = null;
    if (filled(body.hospital_contact)) {
        hospitalContact = normalizePhone(body.hospital_contact);
        if (!hospitalContact) errors.push({ path: 'hospital_contact', message: 'Use a phone number with country code, e.g. +919876543210' });
    }
    const patientRef = text(body.patient_ref);
    if (patientRef.length > 40) errors.push({ path: 'patient_ref', message: 'Use a short ward/bed reference (max 40 characters), not the patient name' });

    if (!isBloodGroup(body.blood_group)) errors.push({ path: 'blood_group', message: 'Must be one of ' + BLOOD_GROUPS.join(', ') });

    // The hospital dashboard posts units as a string
    const units = body.units_required === '' || body.units_required == null ? NaN : Number(body.units_required);
    if (!Number.isInteger(units) || units <= 0 || units > 20) errors.push({ path: 'units_required', message: 'Units required must be a whole number from 1 to 20' });

    const urgency = typeof body.urgency === 'string' && Object.prototype.hasOwnProperty.call(URGENCY_TO_DB, body.urgency) ? URGENCY_TO_DB[body.urgency]! : null;
    if (!urgency) errors.push({ path: 'urgency', message: 'Must be one of ' + Object.keys(URGENCY_TO_DB).join(', ') });

    const hasLat = body.latitude != null;
    const hasLng = body.longitude != null;
    if (hasLat !== hasLng) errors.push({ path: 'latitude', message: 'Send both latitude and longitude, or neither' });
    else if (hasLat && !(validCoord(body.latitude, 90) && validCoord(body.longitude, 180))) errors.push({ path: 'latitude', message: 'Latitude/longitude must be valid decimal degrees' });

    let requiredBy: string | null = null;
    if (filled(body.required_by)) {
        const t = Date.parse(String(body.required_by));
        if (Number.isNaN(t)) errors.push({ path: 'required_by', message: 'Use an ISO date-time, e.g. 2026-09-30T14:00:00+05:30' });
        else requiredBy = new Date(t).toISOString();
    }

    let escalationMinutes = urgency ? ESCALATION_MINUTES[urgency] : 60;
    // Blood needed within 2 hours escalates at the emergency pace whatever the label
    if (requiredBy && Date.parse(requiredBy) - now < 2 * 3600000) escalationMinutes = Math.min(escalationMinutes, 10);
    // Optional override for drills and testing
    if (body.escalation_minutes != null) {
        const m = Number(body.escalation_minutes);
        if (!Number.isInteger(m) || m < 1 || m > 60) errors.push({ path: 'escalation_minutes', message: 'Must be a whole number of minutes from 1 to 60' });
        else escalationMinutes = m;
    }

    if (errors.length || !urgency) return { errors, request: null };
    return {
        errors,
        request: {
            hospital_name: hospitalName,
            hospital_city: hospitalCity,
            hospital_contact: hospitalContact,
            patient_ref: patientRef || null,
            blood_group: body.blood_group as string,
            units_required: units,
            urgency,
            latitude: hasLat ? (body.latitude as number) : null,
            longitude: hasLng ? (body.longitude as number) : null,
            required_by: requiredBy,
            escalation_minutes: escalationMinutes,
            wave_size: waveSize(units, urgency),
            status_token: randomUUID(),
            hospital_token: randomUUID(),
        },
    };
};

// ── Compatibility engine ──────────────────────────────────────────────────

export interface PlannedMatch {
    donor_id: number;
    donor_blood_group: string;
    request_blood_group: string;
    rank: number;
    distance_km: number | null;
    exact_match: boolean;
    status: 'notified' | 'queued';
    response_token: string;
    channel: Channel;
    contact: string | null;
    hospital_name: string;
    hospital_city: string;
    urgency: Urgency;
    units_required: number;
    notified_at: string | null;
}

type MatchableRequest = Pick<NetRequest,
    'blood_group' | 'hospital_name' | 'hospital_city' | 'latitude' | 'longitude' | 'urgency' | 'units_required' | 'wave_size'>;

/**
 * ABO/Rh-compatible, available donors past their rest period and not booked
 * for another request, within 80 km (or in the hospital's city). Ranked by
 * proximity (15 km bands), then ABO-identical donors first and universal O-
 * last (O- is kept for patients who can only take O-), then longest since
 * eligible, then XP. The first wave is alerted now; the rest wait in the queue.
 */
export const matchDonors = (request: MatchableRequest, donors: NetDonor[], now = Date.now()) => {
    const compatible: string[] = compatibleDonorGroups(request.blood_group);
    const hasCoords = request.latitude != null && request.longitude != null;
    const city = request.hospital_city.trim().toLowerCase();
    const sameCity = (c: unknown) => String(c ?? '').trim().toLowerCase() === city;

    const candidates: { d: NetDonor; distance: number | null; tier: number; band: number; daysEligible: number }[] = [];
    for (const d of donors) {
        if (!d.id || d.available !== true || !compatible.includes(d.blood_group)) continue;
        if (d.committed_until && Date.parse(d.committed_until) > now) continue;
        const from = eligibleFromMs(d);
        if (from !== null && from > now) continue;

        let distance: number | null = null;
        if (hasCoords && d.latitude != null && d.longitude != null) {
            distance = distanceKm(d.latitude, d.longitude, request.latitude!, request.longitude!);
            if (distance >= RADIUS_KM) continue;
        } else if (!sameCity(d.city)) {
            continue;
        }
        candidates.push({
            d,
            distance,
            tier: d.blood_group === request.blood_group ? 0 : d.blood_group === 'O-' ? 2 : 1,
            band: Math.floor((distance ?? CITY_ESTIMATE_KM) / BAND_KM),
            daysEligible: from === null ? 3650 : Math.floor((now - from) / DAY),
        });
    }
    candidates.sort((a, b) => a.band - b.band || a.tier - b.tier || b.daysEligible - a.daysEligible || (b.d.xp_points ?? 0) - (a.d.xp_points ?? 0));

    const nowIso = new Date(now).toISOString();
    const matches: PlannedMatch[] = candidates.map((c, i) => {
        const channel = channelFor(c.d);
        const alertNow = i < request.wave_size;
        return {
            donor_id: c.d.id,
            donor_blood_group: c.d.blood_group,
            request_blood_group: request.blood_group,
            rank: i + 1,
            distance_km: c.distance === null ? null : Math.round(c.distance * 10) / 10,
            exact_match: c.tier === 0,
            status: alertNow ? 'notified' : 'queued',
            response_token: randomUUID(),
            channel,
            contact: contactFor(c.d, channel),
            hospital_name: request.hospital_name,
            hospital_city: request.hospital_city,
            urgency: request.urgency,
            units_required: request.units_required,
            notified_at: alertNow ? nowIso : null,
        };
    });
    return { compatible_groups: compatible, match_rule: hasCoords ? `within ${RADIUS_KM} km` : 'same city', matches };
};

// ── Notification engine ───────────────────────────────────────────────────

export type AlertedMatch = Pick<NetMatch,
    'id' | 'request_id' | 'donor_id' | 'donor_blood_group' | 'request_blood_group' | 'distance_km'
    | 'response_token' | 'channel' | 'contact' | 'hospital_name' | 'hospital_city' | 'urgency' | 'units_required'>;

/** What a donor is sent when they are alerted for a request. */
export const composeAlert = (base: string, m: AlertedMatch) => {
    const accept = donorLink(base, m, 'accept');
    const decline = donorLink(base, m, 'decline');
    const bg = m.request_blood_group;
    const away = m.distance_km != null;
    return {
        accept_url: accept,
        decline_url: decline,
        title: `${m.urgency}: ${bg} blood needed at ${m.hospital_name}`,
        message: `${m.hospital_name} (${m.hospital_city}) needs ${m.units_required} unit(s) for ${article(bg)} ${bg} patient`
            + `${away ? `, ${m.distance_km} km from you` : ''}. Your ${m.donor_blood_group} blood is compatible. Can you donate today? Tap YES or NO.`,
        sms_text: `LifeLink ${m.urgency}: ${bg} blood needed at ${m.hospital_name}${away ? ` (${m.distance_km} km)` : ''}. `
            + `Can you donate today? YES: ${accept} NO: ${decline}`,
        // Values for the approved WhatsApp template lifelink_blood_request
        whatsapp_params: [bg, m.hospital_name, accept, decline],
    };
};

// ── Auto-escalation ───────────────────────────────────────────────────────

export interface MatchChange {
    id: number;
    status: MatchStatus;
    notified_at: string | null;
    channel: Channel;
    contact: string | null;
}

export interface EscalationPlan {
    action: 'stop' | 'watch' | 'escalate' | 'exhausted';
    reason?: string;
    round: number;
    updates: MatchChange[];
    notified_now: number;
    expired_now: number;
    donors_notified_total: number;
}

/**
 * One escalation round: expire alerts nobody answered within the window, then
 * alert the next ranked queued donors who are still available, eligible and
 * not committed elsewhere, keeping one wave of alerts out for the units still
 * needed. Stops once the request is completed, cancelled or exhausted, or
 * MAX_HOURS after it was raised.
 */
export const planEscalation = (req: NetRequest, matches: NetMatch[], donors: Map<number, NetDonor>, now: number, round: number): EscalationPlan => {
    const base = { round, updates: [] as MatchChange[], notified_now: 0, expired_now: 0, donors_notified_total: req.donors_notified ?? 0 };
    if (['Completed', 'Cancelled', 'Exhausted'].includes(req.status)) {
        return { ...base, action: 'stop', reason: 'request ' + req.status };
    }

    const committed = matches.filter((m) => m.status === 'accepted' || m.status === 'donated').length;
    const need = req.units_required - committed;
    const ageHours = (now - Date.parse(req.created_at)) / 3600000;
    if (ageHours >= MAX_HOURS) return { ...base, action: need > 0 ? 'exhausted' : 'stop', reason: 'timed_out' };
    // Enough donors have committed: keep watching (a withdrawal or no-show reopens the request)
    if (need <= 0) return { ...base, action: 'watch', reason: 'enough donors committed' };

    const nowIso = new Date(now).toISOString();
    const windowMs = req.escalation_minutes * 60000;
    const donorOf = (m: NetMatch) => (m.donor_id == null ? undefined : donors.get(m.donor_id));
    const stale = matches.filter((m) => m.status === 'notified' && now - Date.parse(m.notified_at ?? '') >= windowMs);
    const outstanding = matches.filter((m) => m.status === 'notified').length - stale.length;
    const queued = matches.filter((m) => m.status === 'queued').sort((a, b) => a.rank - b.rank);
    const skipped = queued.filter((m) => !eligibleNow(donorOf(m), now));
    const next = queued.filter((m) => eligibleNow(donorOf(m), now)).slice(0, Math.max(0, waveSize(need, req.urgency) - outstanding));

    const updates: MatchChange[] = [
        ...stale.map((m) => ({ id: m.id, status: 'expired' as const, notified_at: m.notified_at, channel: m.channel, contact: m.contact })),
        ...skipped.map((m) => ({ id: m.id, status: 'skipped' as const, notified_at: m.notified_at, channel: m.channel, contact: m.contact })),
        ...next.map((m) => {
            const d = donorOf(m)!;
            const channel = channelFor(d);
            return { id: m.id, status: 'notified' as const, notified_at: nowIso, channel, contact: contactFor(d, channel) };
        }),
    ];
    const result = {
        ...base,
        updates,
        notified_now: next.length,
        expired_now: stale.length,
        donors_notified_total: (req.donors_notified ?? 0) + next.length,
    };
    if (outstanding + next.length === 0) return { ...result, action: 'exhausted', reason: 'all_compatible_donors_asked' };
    return { ...result, action: next.length > 0 || stale.length > 0 ? 'escalate' : 'watch' };
};

/** Minutes until the next round: a covered request is only watched, at least every 30 minutes. */
export const minutesUntilNextRound = (req: Pick<NetRequest, 'escalation_minutes'>, plan: Pick<EscalationPlan, 'action' | 'reason'>) =>
    plan.action === 'watch' && plan.reason === 'enough donors committed' ? Math.max(30, req.escalation_minutes) : req.escalation_minutes;
