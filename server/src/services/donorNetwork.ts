/**
 * Bridge to the LifeLink donor network that runs in n8n (matching, alerts,
 * one-tap replies, escalation). The webhook key stays on the server; the
 * browser only ever talks to this API.
 */
const DEFAULT_BASE = 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink';
const TIMEOUT_MS = 10000;

export const ALERT_CHANNELS = ['sms', 'whatsapp', 'in_app'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export class NetworkError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export interface NetworkProfile {
    name: string;
    phone: string;
    blood_group: string;
    city: string;
    gender?: string | null;
}

export interface PreferenceChange {
    available?: boolean;
    preferred_channel?: AlertChannel;
}

export const networkConfigured = (): boolean => !!process.env.N8N_WEBHOOK_KEY;

/** Normalises to E.164, treating bare 10-digit numbers as Indian mobiles. */
export const toE164 = (phone: string | null | undefined): string | null => {
    const raw = String(phone ?? '').replace(/[\s()-]/g, '');
    if (/^\+\d{10,15}$/.test(raw)) return raw;
    if (/^0?\d{10}$/.test(raw)) return '+91' + raw.slice(-10);
    if (/^91\d{10}$/.test(raw)) return '+' + raw;
    return null;
};

const post = async (path: string, body: object): Promise<{ status: number; data: any }> => {
    const key = process.env.N8N_WEBHOOK_KEY;
    if (!key) throw new NetworkError('The donor network is not configured.', 503);

    const res = await fetch(`${process.env.N8N_WEBHOOK_BASE || DEFAULT_BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LifeLink-Key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
};

/** Creates or updates the donor in the network registry (keyed by phone). */
export const registerDonor = async (profile: NetworkProfile, change: PreferenceChange = {}) => {
    const { status, data } = await post('donors', {
        name: profile.name,
        phone: profile.phone,
        blood_group: profile.blood_group,
        city: profile.city,
        ...(profile.gender ? { gender: profile.gender } : {}),
        available: change.available ?? true,
        preferred_channel: change.preferred_channel ?? 'sms',
    });
    if (status !== 200 && status !== 201) {
        throw new NetworkError(`Registry rejected the donor profile (${status})`, status);
    }
    return data;
};

/** Reads the donor's view, applying `change` first when given. 404 = not enrolled. */
export const donorPortal = (phone: string, change?: PreferenceChange) =>
    post('donor-portal', change ? { phone, action: 'update', ...change } : { phone, action: 'status' });

export interface DispatchPayload {
    hospital_name: string;
    hospital_city: string;
    hospital_contact?: string | undefined;
    patient_ref?: string | undefined;
    blood_group: string;
    units_required: number;
    urgency: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    required_by?: string | undefined;
}

export interface DispatchResult {
    status: 'dispatched' | 'no_compatible_donors';
    request_id: number;
    tracking_token: string | null;
    hospital_token: string;
    compatible_donors: number;
    donors_alerted: number;
    donors_on_standby: number;
    escalation_minutes: number | null;
    message?: string;
}

/** Raises the request on the network, which matches and alerts donors straight away. */
export const dispatchRequest = async (payload: DispatchPayload): Promise<DispatchResult> => {
    const { status, data } = await post('emergency-request', payload);
    if (status === 400) {
        const reasons = Array.isArray(data?.errors) ? data.errors.map((e: any) => e.message).join('; ') : '';
        throw new NetworkError(reasons || 'The donor network rejected the request.', 400);
    }
    if (status !== 201 && status !== 200) throw new NetworkError(`Donor network answered ${status}`, status);

    const token = String(data.tracking_url ?? '').match(/token=([0-9a-f-]{36})/i);
    return {
        status: data.status,
        request_id: data.request_id,
        tracking_token: token?.[1] ?? null,
        hospital_token: data.hospital_token,
        compatible_donors: data.compatible_donors ?? 0,
        donors_alerted: Array.isArray(data.donors_alerted) ? data.donors_alerted.length : 0,
        donors_on_standby: data.donors_on_standby ?? 0,
        escalation_minutes: data.escalation_minutes ?? null,
        message: data.message,
    };
};

export interface HospitalDonorView {
    match_id: number;
    name: string;
    phone: string | null;
    blood_group: string;
    distance_km: number | null;
    pass_code?: string;
    status: 'accepted' | 'donated' | 'no_show';
    responded_at: string | null;
    donated_url: string | null;
    no_show_url: string | null;
}

export interface HospitalRequestView {
    request_id: number;
    found: boolean;
    status?: string;
    units_confirmed?: number;
    units_donated?: number;
    donors?: HospitalDonorView[];
    [key: string]: unknown;
}

/** Live progress of a hospital's own requests, with confirmed donors and action links. */
export const hospitalPortal = async (requests: { request_id: number; hospital_token: string }[]): Promise<HospitalRequestView[]> => {
    const { status, data } = await post('hospital-portal', { requests });
    if (status !== 200 || !Array.isArray(data?.requests)) throw new NetworkError(`Hospital portal answered ${status}`, status);
    return data.requests;
};

/**
 * Enrols a newly registered donor. Sign-up must not fail because the network
 * is down or not configured, so errors are logged and swallowed.
 */
export const enrolDonor = async (profile: Omit<NetworkProfile, 'phone'> & { phone?: string | null }, change: PreferenceChange = {}) => {
    const phone = toE164(profile.phone);
    if (!networkConfigured() || !phone) return;
    try {
        await registerDonor({ ...profile, phone }, change);
    } catch (err: any) {
        console.error('Donor network enrolment failed:', err?.message ?? err);
    }
};
