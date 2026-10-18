/** Rows of the network tables, read into the shapes the rules work with. */
import type { NetDonor, NetMatch, NetRequest } from './rules';

export interface Queryable {
    query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
}

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string | number | Date).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));

// DATE columns are read as text: pg would turn them into local-midnight Date objects.
// The entry of an account an admin deactivated is never available.
export const DONOR_COLUMNS = `id, name, phone, blood_group, gender, city, latitude, longitude,
    (available AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = network_donors.user_id AND u.disabled_at IS NOT NULL)) AS available,
    to_char(last_donation_date, 'YYYY-MM-DD') AS last_donation_date, total_donations, preferred_channel,
    fcm_token, xp_points, committed_until, source, user_id, blood_group_verified_at`;

export const REQUEST_COLUMNS = `id, hospital_name, hospital_city, hospital_contact, patient_ref, blood_group,
    units_required, urgency, latitude, longitude, required_by, status, units_confirmed, units_donated,
    compatible_donors, donors_notified, wave_size, escalation_minutes, escalation_rounds, status_token,
    hospital_token, first_accept_at, fulfilled_at, closed_reason, closed_at, next_check_at, created_at, updated_at`;

export const MATCH_COLUMNS = `id, request_id, donor_id, donor_blood_group, request_blood_group, rank, distance_km,
    exact_match, status, response_token, channel, contact, hospital_name, hospital_city, urgency, units_required,
    notified_at, responded_at, lab_blood_group, lab_recorded_at, created_at, updated_at`;

export const toDonor = (r: any): NetDonor => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    blood_group: r.blood_group,
    gender: r.gender,
    city: r.city,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    available: r.available === true,
    last_donation_date: r.last_donation_date ?? null,
    total_donations: Number(r.total_donations ?? 0),
    preferred_channel: r.preferred_channel,
    fcm_token: r.fcm_token ?? null,
    xp_points: Number(r.xp_points ?? 0),
    committed_until: iso(r.committed_until),
    source: r.source,
    user_id: r.user_id ?? null,
    blood_group_verified_at: iso(r.blood_group_verified_at),
});

export const toRequest = (r: any): NetRequest => ({
    id: r.id,
    hospital_name: r.hospital_name,
    hospital_city: r.hospital_city,
    hospital_contact: r.hospital_contact ?? null,
    patient_ref: r.patient_ref ?? null,
    blood_group: r.blood_group,
    units_required: Number(r.units_required),
    urgency: r.urgency,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    required_by: iso(r.required_by),
    status: r.status,
    units_confirmed: Number(r.units_confirmed ?? 0),
    units_donated: Number(r.units_donated ?? 0),
    compatible_donors: Number(r.compatible_donors ?? 0),
    donors_notified: Number(r.donors_notified ?? 0),
    wave_size: Number(r.wave_size),
    escalation_minutes: Number(r.escalation_minutes),
    escalation_rounds: Number(r.escalation_rounds ?? 0),
    status_token: r.status_token,
    hospital_token: r.hospital_token,
    first_accept_at: iso(r.first_accept_at),
    fulfilled_at: iso(r.fulfilled_at),
    closed_reason: r.closed_reason ?? null,
    closed_at: iso(r.closed_at),
    next_check_at: iso(r.next_check_at),
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!,
});

export const toMatch = (r: any): NetMatch => ({
    id: r.id,
    request_id: r.request_id,
    donor_id: r.donor_id ?? null,
    donor_blood_group: r.donor_blood_group,
    request_blood_group: r.request_blood_group,
    rank: Number(r.rank),
    distance_km: num(r.distance_km),
    exact_match: r.exact_match === true,
    status: r.status,
    response_token: r.response_token,
    channel: r.channel,
    contact: r.contact ?? null,
    hospital_name: r.hospital_name,
    hospital_city: r.hospital_city,
    urgency: r.urgency,
    units_required: Number(r.units_required),
    notified_at: iso(r.notified_at),
    responded_at: iso(r.responded_at),
    lab_blood_group: r.lab_blood_group ?? null,
    lab_recorded_at: iso(r.lab_recorded_at),
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!,
});

export const first = <T>(map: (r: any) => T, result: { rows: any[] }): T | null => (result.rows[0] ? map(result.rows[0]) : null);
