/**
 * The LifeLink donor network as the rest of the API sees it: matching, alerts,
 * one-tap replies and escalation (src/network), plus the account emails.
 * Until October 2026 this module called n8n webhooks; the network now runs
 * inside this API and its Postgres database, so nothing here needs a key.
 */
import * as engine from '../network/engine';
import { AccountEmail, CampaignDetails, CampaignRecipient, accountEmail } from '../network/messages';
import { sendEmail } from './messaging';

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

/** The network is part of LifeLink; only its SMS, WhatsApp and email channels need settings. */
export const networkConfigured = (): boolean => true;

/** Normalises to E.164, treating bare 10-digit numbers as Indian mobiles. */
export const toE164 = (phone: string | null | undefined): string | null => {
    const raw = String(phone ?? '').replace(/[\s()-]/g, '');
    if (/^\+\d{10,15}$/.test(raw)) return raw;
    if (/^0?\d{10}$/.test(raw)) return '+91' + raw.slice(-10);
    if (/^91\d{10}$/.test(raw)) return '+' + raw;
    return null;
};

/**
 * Creates or updates the donor in the network registry (keyed by phone) for
 * website account `ownerId`. A phone that belongs to another account throws a
 * 409 NetworkError.
 */
export const registerDonor = async (profile: NetworkProfile, change: PreferenceChange = {}, ownerId?: number) => {
    const { status, data } = await engine.upsertDonor({
        name: profile.name,
        phone: profile.phone,
        blood_group: profile.blood_group,
        city: profile.city,
        ...(profile.gender ? { gender: profile.gender } : {}),
        available: change.available ?? true,
        preferred_channel: change.preferred_channel ?? 'sms',
    }, ownerId);
    if (status === 409) throw new NetworkError(engine.PHONE_TAKEN, 409);
    if (status !== 200 && status !== 201) {
        throw new NetworkError(`Registry rejected the donor profile (${status})`, status);
    }
    return data;
};

/**
 * Reads the donor's view for website account `ownerId`, applying `change`
 * first when given. 404 = not enrolled; 409 = the phone belongs to another account.
 */
export const donorPortal = (phone: string, change?: PreferenceChange, ownerId?: number): Promise<{ status: number; data: any }> =>
    engine.donorPortal(change ? { phone, action: 'update', ...change } : { phone, action: 'status' }, ownerId);

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
    const { status, data } = await engine.dispatch({ ...payload });
    if (status === 400) {
        const reasons = Array.isArray(data?.errors) ? data.errors.map((e: any) => e.message).join('; ') : '';
        throw new NetworkError(reasons || 'The donor network rejected the request.', 400);
    }

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
    const { status, data } = await engine.hospitalPortal(requests);
    if (status !== 200 || !Array.isArray(data?.requests)) throw new NetworkError(`Hospital portal answered ${status}`, status);
    return data.requests;
};

/**
 * Enrols a newly registered donor. Sign-up must not fail because of the
 * network, so errors are logged and swallowed.
 */
export const enrolDonor = async (profile: Omit<NetworkProfile, 'phone'> & { phone?: string | null }, change: PreferenceChange = {}, ownerId?: number) => {
    const phone = toE164(profile.phone);
    if (!phone) return;
    try {
        await registerDonor({ ...profile, phone }, change, ownerId);
    } catch (err: any) {
        console.error('Donor network enrolment failed:', err?.message ?? err);
    }
};

/** Invites donors to a campaign by SMS, WhatsApp and email (sent in the background). */
export const broadcastCampaign = (payload: {
    campaign_id?: number | null; campaign: CampaignDetails; register_url: string; recipients: CampaignRecipient[];
}) => engine.broadcastCampaign(payload);

/** Emails an account holder: a password reset code, or a "password changed" notice. */
export const sendAccountEmail = async (payload: AccountEmail) => {
    const mail = accountEmail(payload);
    const result = await sendEmail(mail.to, mail.subject, mail.html);
    if (result.status !== 'sent') throw new NetworkError(result.error, result.status === 'skipped' ? 503 : 502);
};
