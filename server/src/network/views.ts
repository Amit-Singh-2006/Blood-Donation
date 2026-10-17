/**
 * What the network shows: the donor's own view, the hospital's view of its
 * requests, the family's tracking view and the public statistics. Also the
 * input rules for the donor registry and the donor portal.
 */
import { BLOOD_GROUPS, recipientGroupsFor } from '../utils/bloodCompatibility';
import {
    FieldError, NetDonor, NetMatch, NetRequest, cancelLink, deferralDays, donorLink, eligibleFromDate, eligibleFromMs,
    filled, firstName, hospitalLink, isBloodGroup, normalizePhone, passCode, text, validCoord,
} from './rules';

const time = (v: string | null | undefined) => Date.parse(v || '') || 0;

// ── Donor portal ──────────────────────────────────────────────────────────

export const PORTAL_CHANNELS = ['sms', 'whatsapp', 'in_app'] as const;

export interface PortalRequest {
    errors: FieldError[];
    phone: string | null;
    action: 'status' | 'update';
    available: boolean | null;
    preferred_channel: string | null;
}

/** action "status" reads the donor's view; "update" changes availability and/or the alert channel. */
export const validatePortal = (body: Record<string, unknown>): PortalRequest => {
    const errors: FieldError[] = [];
    const phone = normalizePhone(body.phone);
    if (!phone) errors.push({ path: 'phone', message: 'Use a mobile number with country code, e.g. +919876543210' });

    const action = (body.action ?? 'status') as PortalRequest['action'];
    if (!['status', 'update'].includes(action)) errors.push({ path: 'action', message: 'Must be status or update' });

    let available: boolean | null = null;
    if (body.available !== undefined) {
        if (typeof body.available !== 'boolean') errors.push({ path: 'available', message: 'Must be true or false' });
        else available = body.available;
    }
    let channel: string | null = null;
    if (body.preferred_channel !== undefined) {
        channel = String(body.preferred_channel).toLowerCase();
        if (!(PORTAL_CHANNELS as readonly string[]).includes(channel)) errors.push({ path: 'preferred_channel', message: 'Must be one of ' + PORTAL_CHANNELS.join(', ') });
    }
    if (action === 'update' && available === null && channel === null) errors.push({ path: 'action', message: 'Send available and/or preferred_channel to update' });
    return { errors, phone, action, available, preferred_channel: channel };
};

/**
 * The donor's own view: profile, live alerts with their one-tap links, and
 * donation history. Only the logged-in donor's phone is ever looked up, so
 * the links never reach anyone else.
 */
export const buildDonorView = (donor: NetDonor, matches: NetMatch[], now: number, base: string) => {
    const eligibleFrom = eligibleFromDate(donor);
    const when = (m: NetMatch) => time(m.responded_at || m.notified_at || m.updated_at || m.created_at);

    const alerts = matches
        .filter((m) => ['notified', 'accepted'].includes(m.status))
        .sort((a, b) => when(b) - when(a))
        .map((m) => ({
            match_id: m.id,
            request_id: m.request_id,
            status: m.status === 'accepted' ? 'accepted' : 'awaiting_reply',
            hospital_name: m.hospital_name,
            hospital_city: m.hospital_city,
            blood_group_needed: m.request_blood_group,
            urgency: m.urgency,
            units_required: m.units_required,
            distance_km: m.distance_km,
            alerted_at: m.notified_at,
            accept_url: m.status === 'notified' ? donorLink(base, m, 'accept') : null,
            pass_code: m.status === 'accepted' ? passCode(m.response_token) : null,
            // After accepting, the decline link withdraws and alerts the next donor
            decline_url: donorLink(base, m, 'decline'),
        }));

    const history = matches
        .filter((m) => m.status === 'donated')
        .sort((a, b) => when(b) - when(a))
        .map((m) => ({
            request_id: m.request_id,
            hospital_name: m.hospital_name,
            hospital_city: m.hospital_city,
            blood_group_needed: m.request_blood_group,
            donated_on: String(m.responded_at || m.updated_at || '').slice(0, 10),
            lab_blood_group: m.lab_blood_group ?? null,
        }));

    // The latest lab result decided the donor's blood group
    const lab = matches
        .filter((m) => m.lab_blood_group && m.lab_recorded_at)
        .sort((a, b) => time(b.lab_recorded_at) - time(a.lab_recorded_at))[0];
    const committed = donor.committed_until && Date.parse(donor.committed_until) > now ? donor.committed_until : null;
    return {
        registered: true,
        donor: {
            name: donor.name,
            blood_group: donor.blood_group,
            // Self-reported until a hospital's lab tests it after a donation
            blood_group_verified: !!donor.blood_group_verified_at,
            blood_group_verified_at: donor.blood_group_verified_at ?? null,
            blood_group_verified_by: donor.blood_group_verified_at ? lab?.hospital_name ?? null : null,
            // What the donor had said, when the lab found a different group
            blood_group_corrected_from: lab && lab.donor_blood_group !== lab.lab_blood_group ? lab.donor_blood_group : null,
            city: donor.city,
            available: donor.available,
            preferred_channel: donor.preferred_channel,
            total_donations: donor.total_donations ?? 0,
            xp_points: donor.xp_points ?? 0,
            last_donation_date: donor.last_donation_date ?? null,
            eligible_from: eligibleFrom,
            eligible_now: !eligibleFrom || Date.parse(eligibleFrom + 'T00:00:00Z') <= now,
            committed_until: committed,
        },
        alerts,
        history,
        stats: {
            alerts_received: matches.filter((m) => m.notified_at).length,
            accepted: matches.filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status)).length,
            donations_via_lifelink: history.length,
        },
    };
};

// ── Hospital portal ───────────────────────────────────────────────────────

export const HOSPITAL_PORTAL_MAX = 25;

/** The hospital asks for its requests in one call, each with the hospital token the dispatch returned. */
export const parseHospitalPortal = (list: unknown): { request_id: number; hospital_token: string }[] =>
    (Array.isArray(list) ? list : [])
        .filter((r: any) => r && Number.isInteger(r.request_id) && r.request_id > 0 && /^[0-9a-f-]{36}$/i.test(String(r.hospital_token ?? '')))
        .slice(0, HOSPITAL_PORTAL_MAX)
        .map((r: any) => ({ request_id: r.request_id as number, hospital_token: String(r.hospital_token).toLowerCase() }));

/**
 * The hospital's own view of a request: live progress, the donors who
 * confirmed (first name and phone, so staff can coordinate) and the one-tap
 * action links. Returned only when the hospital token matches.
 */
export const buildHospitalView = (
    wanted: { request_id: number; hospital_token: string },
    req: NetRequest | undefined,
    matches: NetMatch[],
    donors: Map<number, NetDonor>,
    base: string,
) => {
    if (!req || req.hospital_token !== wanted.hospital_token) return { request_id: wanted.request_id, found: false as const };

    const own = matches.filter((m) => m.request_id === req.id);
    const count = (...statuses: string[]) => own.filter((m) => statuses.includes(m.status)).length;
    // Anything not finished can be cancelled, including a search that ran out of donors
    const cancellable = !['Completed', 'Cancelled'].includes(req.status);

    const confirmed = own
        .filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status))
        .sort((a, b) => time(a.responded_at) - time(b.responded_at))
        .map((m) => {
            const d = m.donor_id == null ? undefined : donors.get(m.donor_id);
            return {
                match_id: m.id,
                name: firstName(d?.name, 'Donor'),
                phone: d?.phone ?? null,
                blood_group: m.donor_blood_group,
                distance_km: m.distance_km ?? null,
                // What the donor's QR carries; staff scan it at the gate to confirm who arrived
                pass_code: passCode(m.response_token),
                status: m.status as 'accepted' | 'donated' | 'no_show',
                responded_at: m.responded_at ?? null,
                // The group this hospital's lab found for this donation, and whether
                // the donor's group was already lab-confirmed (by any hospital)
                lab_blood_group: m.lab_blood_group ?? null,
                blood_group_verified: !!d?.blood_group_verified_at,
                donated_url: m.status === 'accepted' ? hospitalLink(base, m.id, req.hospital_token, 'donated') : null,
                no_show_url: m.status === 'accepted' ? hospitalLink(base, m.id, req.hospital_token, 'no_show') : null,
            };
        });

    return {
        request_id: req.id,
        found: true as const,
        status: req.status,
        blood_group: req.blood_group,
        urgency: req.urgency,
        units_required: req.units_required,
        units_confirmed: count('accepted', 'donated'),
        units_donated: count('donated'),
        patient_ref: req.patient_ref ?? null,
        created_at: req.created_at,
        first_accept_at: req.first_accept_at ?? null,
        fulfilled_at: req.fulfilled_at ?? null,
        closed_reason: req.closed_reason ?? null,
        compatible_donors: req.compatible_donors ?? own.length,
        donors_alerted: own.filter((m) => m.notified_at).length,
        donors_declined: count('declined'),
        donors_no_reply: count('expired'),
        donors_on_standby: count('queued'),
        next_check_at: req.status === 'Open' ? req.next_check_at : null,
        tracking_token: req.status_token,
        cancel_url: cancellable ? cancelLink(base, req) : null,
        donors: confirmed,
    };
};

// ── Tracking (patient side) ───────────────────────────────────────────────

/**
 * Progress for the hospital and the patient's family: counts, blood groups
 * and distances only, never donor names, phones or tokens.
 */
export const buildTracking = (req: NetRequest, matches: NetMatch[]) => {
    const count = (...statuses: string[]) => matches.filter((m) => statuses.includes(m.status)).length;
    const alertTimes = matches.map((m) => m.notified_at).filter((t): t is string => !!t).sort();
    const firstAlert = alertTimes[0];
    const lastAlert = alertTimes[alertTimes.length - 1];
    const minutesBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

    const NEXT_STEP: Record<string, string> = {
        Open: 'We are alerting compatible donors near ' + req.hospital_name + ' and alert the next ranked donors every ' + req.escalation_minutes + ' minutes until ' + req.units_required + ' unit(s) are confirmed.',
        Fulfilled: 'Enough donors have confirmed and are on their way to ' + req.hospital_name + '. The hospital confirms each donation on arrival.',
        Completed: 'All ' + req.units_required + ' unit(s) have been donated. Thank you for your patience.',
        Exhausted: 'Every compatible donor in range has been asked. The hospital has been told to contact the regional blood bank; late donor replies are still counted here.',
        Cancelled: 'The hospital cancelled this request.',
    };

    const timeline: { at: string; event: string }[] = [{ at: req.created_at, event: 'Request raised by ' + req.hospital_name }];
    if (firstAlert) timeline.push({ at: firstAlert, event: 'First compatible donors alerted' });
    if ((req.escalation_rounds ?? 0) > 0 && lastAlert && lastAlert !== firstAlert) {
        timeline.push({ at: lastAlert, event: 'More donors alerted (escalation round ' + req.escalation_rounds + ')' });
    }
    if (req.first_accept_at) timeline.push({ at: req.first_accept_at, event: 'First donor confirmed (' + minutesBetween(req.created_at, req.first_accept_at) + ' min after the request)' });
    if (req.fulfilled_at) timeline.push({ at: req.fulfilled_at, event: 'All units covered by confirmed donors' });
    if (['Completed', 'Exhausted', 'Cancelled'].includes(req.status)) timeline.push({ at: req.closed_at ?? req.updated_at, event: 'Request ' + req.status.toLowerCase() });
    timeline.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    return {
        request_id: req.id,
        status: req.status,
        hospital_name: req.hospital_name,
        hospital_city: req.hospital_city,
        patient_ref: req.patient_ref ?? null,
        blood_group: req.blood_group,
        urgency: req.urgency,
        units_required: req.units_required,
        units_confirmed: count('accepted', 'donated'),
        units_donated: count('donated'),
        compatible_donors_found: req.compatible_donors ?? matches.length,
        donors_alerted: alertTimes.length,
        donors_declined: count('declined'),
        donors_no_response: count('expired'),
        donors_on_standby: count('queued'),
        confirmed_donors: matches.filter((m) => ['accepted', 'donated'].includes(m.status))
            .map((m) => ({ blood_group: m.donor_blood_group, distance_km: m.distance_km, state: m.status === 'donated' ? 'donated' : 'on the way' })),
        next_check_at: req.status === 'Open' ? req.next_check_at : null,
        next_step: NEXT_STEP[req.status] ?? '',
        timeline,
    };
};

// ── Analytics ─────────────────────────────────────────────────────────────

/** Open vs fulfilled requests, donor pool and response rates, the 15-minute first-donor target and compatibility impact. */
export const computeAnalytics = (requests: NetRequest[], matches: NetMatch[], donors: NetDonor[], now: number) => {
    const round1 = (x: number) => Math.round(x * 10) / 10;
    const pct = (a: number, b: number) => (b ? round1((a / b) * 100) : null);
    const median = (xs: number[]) => {
        if (!xs.length) return null;
        const s = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return round1(s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2);
    };
    const minutes = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 60000;
    const committedNow = (d: NetDonor) => !!d.committed_until && Date.parse(d.committed_until) > now;
    const eligibleNow = (d: NetDonor) => {
        const from = eligibleFromMs(d);
        return d.available === true && !committedNow(d) && (from === null || from <= now);
    };

    const byStatus: Record<string, number> = {};
    for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const covered = (byStatus.Fulfilled ?? 0) + (byStatus.Completed ?? 0);
    const firstDonor = requests.filter((r) => r.first_accept_at).map((r) => minutes(r.created_at, r.first_accept_at!));

    const alerted = matches.filter((m) => m.notified_at);
    const responded = alerted.filter((m) => ['accepted', 'declined', 'donated', 'no_show'].includes(m.status));
    const accepted = alerted.filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status));
    const byChannel: Record<string, number> = {};
    for (const m of alerted) byChannel[m.channel || 'in_app'] = (byChannel[m.channel || 'in_app'] ?? 0) + 1;
    const otherGroups = accepted.filter((m) => m.exact_match === false).length;

    return {
        generated_at: new Date(now).toISOString(),
        requests: {
            total: requests.length,
            open: byStatus.Open ?? 0,
            fulfilled: byStatus.Fulfilled ?? 0,
            completed: byStatus.Completed ?? 0,
            exhausted: byStatus.Exhausted ?? 0,
            cancelled: byStatus.Cancelled ?? 0,
            covered_pct: pct(covered, requests.length - (byStatus.Cancelled ?? 0)),
            median_minutes_to_first_donor: median(firstDonor),
            first_donor_within_15_min_pct: pct(firstDonor.filter((x) => x <= 15).length, firstDonor.length),
        },
        donor_pool: {
            registered: donors.length,
            available: donors.filter((d) => d.available === true).length,
            eligible_now: donors.filter(eligibleNow).length,
            committed_now: donors.filter(committedNow).length,
            by_blood_group: Object.fromEntries(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((g) => [g, {
                registered: donors.filter((d) => d.blood_group === g).length,
                eligible_now: donors.filter((d) => d.blood_group === g && eligibleNow(d)).length,
            }])) as Record<string, { registered: number; eligible_now: number }>,
        },
        responses: {
            alerts_sent: alerted.length,
            responded: responded.length,
            response_rate_pct: pct(responded.length, alerted.length),
            accepted: accepted.length,
            acceptance_rate_pct: pct(accepted.length, alerted.length),
            declined: alerted.filter((m) => m.status === 'declined').length,
            no_response: alerted.filter((m) => m.status === 'expired').length,
            median_response_minutes: median(responded.filter((m) => m.responded_at).map((m) => minutes(m.notified_at!, m.responded_at!))),
            donations_logged: matches.filter((m) => m.status === 'donated').length,
            no_shows: matches.filter((m) => m.status === 'no_show').length,
            alerts_by_channel: byChannel,
        },
        compatibility: {
            accepted_from_other_compatible_groups: otherGroups,
            share_of_accepted_pct: pct(otherGroups, accepted.length),
        },
    };
};

export type NetworkAnalytics = ReturnType<typeof computeAnalytics>;

// ── Donor registry ────────────────────────────────────────────────────────

export const REGISTRY_CHANNELS = ['push', 'sms', 'whatsapp', 'in_app'] as const;

export interface RegistryProfile {
    name: string;
    phone: string;
    blood_group: string;
    gender: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    available: boolean;
    last_donation_date: string | null;
    total_donations: number | null;
    preferred_channel: string;
    fcm_token: string | null;
}

/**
 * Registry capture: blood group, location, availability and donation history.
 * The phone number is the donor's identity (it is also how USSD recognises
 * them), so a second submission updates the same profile.
 */
export const validateRegistry = (body: Record<string, unknown>, now = Date.now()): { errors: FieldError[]; warnings: string[]; profile: RegistryProfile | null } => {
    const errors: FieldError[] = [];
    const has = (k: string) => filled(body[k]);

    const phone = normalizePhone(body.phone);
    if (!phone) errors.push({ path: 'phone', message: 'Use a mobile number with country code, e.g. +919876543210' });
    const name = text(body.name);
    if (name.length < 2 || name.length > 100) errors.push({ path: 'name', message: 'Name is required (2-100 characters)' });
    if (!isBloodGroup(body.blood_group)) errors.push({ path: 'blood_group', message: 'Must be one of ' + BLOOD_GROUPS.join(', ') });
    const city = text(body.city);
    if (city.length < 2 || city.length > 100) errors.push({ path: 'city', message: 'City is required (2-100 characters)' });

    const gender = has('gender') ? String(body.gender).toLowerCase() : 'unspecified';
    if (!['male', 'female', 'other', 'unspecified'].includes(gender)) errors.push({ path: 'gender', message: 'Must be male, female or other' });

    const hasLat = has('latitude');
    const hasLng = has('longitude');
    if (hasLat !== hasLng) errors.push({ path: 'latitude', message: 'Send both latitude and longitude, or neither' });
    else if (hasLat && !(validCoord(body.latitude, 90) && validCoord(body.longitude, 180))) errors.push({ path: 'latitude', message: 'Latitude/longitude must be valid decimal degrees' });

    let lastDonation: string | null = null;
    if (has('last_donation_date')) {
        const s = String(body.last_donation_date);
        const t = Date.parse(s + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(t)) errors.push({ path: 'last_donation_date', message: 'Use YYYY-MM-DD' });
        else if (t > now) errors.push({ path: 'last_donation_date', message: 'Cannot be in the future' });
        else lastDonation = s;
    }
    let totalDonations: number | null = null;
    if (has('total_donations')) {
        const n = Number(body.total_donations);
        if (!Number.isInteger(n) || n < 0 || n > 500) errors.push({ path: 'total_donations', message: 'Must be a whole number from 0 to 500' });
        else totalDonations = n;
    }
    let available = true;
    if (has('available')) {
        if (typeof body.available !== 'boolean') errors.push({ path: 'available', message: 'Must be true or false' });
        else available = body.available;
    }
    let channel = has('preferred_channel') ? String(body.preferred_channel).toLowerCase() : 'sms';
    if (!(REGISTRY_CHANNELS as readonly string[]).includes(channel)) errors.push({ path: 'preferred_channel', message: 'Must be one of ' + REGISTRY_CHANNELS.join(', ') });
    const fcmToken = has('fcm_token') ? String(body.fcm_token).slice(0, 4096) : null;
    const warnings: string[] = [];
    if (channel === 'push' && !fcmToken) {
        channel = 'sms';
        warnings.push('Push needs an fcm_token from the app; alerts will go by SMS until one is registered.');
    }

    if (errors.length) return { errors, warnings, profile: null };
    return {
        errors,
        warnings,
        profile: {
            name, phone: phone!, blood_group: body.blood_group as string, gender, city,
            latitude: hasLat ? (body.latitude as number) : null,
            longitude: hasLng ? (body.longitude as number) : null,
            available,
            last_donation_date: lastDonation,
            total_donations: totalDonations,
            preferred_channel: channel,
            fcm_token: fcmToken,
        },
    };
};

/** The registry's reply: when the donor is next eligible and whom their blood can help. */
export const registryReply = (
    profile: RegistryProfile, saved: Pick<NetDonor, 'id' | 'last_donation_date'> & { blood_group?: string },
    isNew: boolean, warnings: string[], now = Date.now(),
) => {
    const eligibleFrom = eligibleFromDate({ last_donation_date: saved.last_donation_date, gender: profile.gender });
    // A lab-confirmed group is kept, whatever the profile says
    const bloodGroup = saved.blood_group ?? profile.blood_group;
    return {
        donor_id: saved.id,
        status: isNew ? 'registered' : 'updated',
        blood_group: bloodGroup,
        available: profile.available,
        alerts_via: profile.preferred_channel,
        eligibility: {
            deferral_days: deferralDays(profile.gender),
            last_donation_date: saved.last_donation_date,
            eligible_from: eligibleFrom,
            eligible_now: !eligibleFrom || Date.parse(eligibleFrom + 'T00:00:00Z') <= now,
        },
        your_blood_can_help: recipientGroupsFor(bloodGroup),
        warnings: bloodGroup === profile.blood_group ? warnings
            : [...warnings, `A hospital lab confirmed your blood group as ${bloodGroup}, so it stays ${bloodGroup}.`],
    };
};
