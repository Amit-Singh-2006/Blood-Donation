/**
 * USSD menus for basic phones (Africa's Talking style callbacks). The mobile
 * network supplies the caller's number, which is the login; `text` holds every
 * menu choice so far ("1*2"). Replies start with CON (show a menu and keep the
 * session open) or END.
 */
import { BLOOD_GROUPS } from '../utils/bloodCompatibility';
import { NetDonor, NetMatch, article, eligibleFromMs, firstName, normalizePhone } from './rules';

export interface UssdSession {
    session_id: string;
    service_code: string;
    phone: string | null;
    steps: string[];
}

export const parseUssd = (b: Record<string, unknown>): UssdSession => {
    const textValue = String(b.text ?? '').trim();
    return {
        session_id: String(b.sessionId ?? ''),
        service_code: String(b.serviceCode ?? ''),
        phone: normalizePhone(b.phoneNumber),
        steps: textValue === '' ? [] : textValue.split('*').map((s) => s.trim()),
    };
};

export type UssdStep =
    | { action: 'none'; reply: string }
    | { action: 'register'; reply: string; register: { phone: string; blood_group: string; city: string } }
    | { action: 'set_availability'; reply: string; availability: { id: number; available: boolean } }
    | { action: 'respond'; reply: string; respond: { match_id: number; token: string; action: 'accept' | 'decline'; hospital_name: string } };

/** Indian date format for the handset: DD/MM/YYYY. */
const dmy = (iso: string) => {
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return d + '/' + m + '/' + y;
};

/**
 * Registered donors: see and answer blood requests, check eligibility, turn
 * alerts on or off. Unknown numbers: register with blood group and city.
 * `pending` are the donor's alerts still waiting for a reply.
 */
export const ussdMenu = (s: UssdSession, donor: NetDonor | null, pending: NetMatch[], now: number): UssdStep => {
    const steps = s.steps;
    const invalid: UssdStep = { action: 'none', reply: 'END Invalid choice. Please dial again.' };
    const alerts = [...pending].sort((a, b) => String(b.notified_at).localeCompare(String(a.notified_at))).slice(0, 3);

    if (!s.phone) return { action: 'none', reply: 'END Sorry, we could not read your phone number.' };

    if (!donor) {
        if (steps.length === 0) return { action: 'none', reply: 'CON Welcome to LifeLink.\nThis number is not registered as a blood donor.\n1. Register now\n2. Exit' };
        if (steps[0] === '2' && steps.length === 1) return { action: 'none', reply: 'END Thank you. Dial again any time to register.' };
        if (steps[0] === '1' && steps.length === 1) {
            return { action: 'none', reply: 'CON Select your blood group:\n' + BLOOD_GROUPS.map((g, i) => (i + 1) + '. ' + g).join('\n') + '\n9. Not sure' };
        }
        if (steps[0] === '1' && steps.length === 2) {
            const g = Number(steps[1]);
            if (g === 9) return { action: 'none', reply: 'END Please get your blood group tested at any blood bank or hospital, then dial again to register.' };
            if (g >= 1 && g <= 8) return { action: 'none', reply: 'CON Enter your city or town:' };
        }
        if (steps[0] === '1' && steps.length >= 3) {
            const g = Number(steps[1]);
            const cityRaw = steps.slice(2).join(' ').trim();
            if (g >= 1 && g <= 8 && cityRaw.length >= 2 && cityRaw.length <= 60) {
                const city = cityRaw.charAt(0).toUpperCase() + cityRaw.slice(1);
                const group = BLOOD_GROUPS[g - 1]!;
                return {
                    action: 'register',
                    register: { phone: s.phone, blood_group: group, city },
                    reply: 'END Registered as ' + article(group) + ' ' + group + ' donor in ' + city + '. We will text you when your blood can help a patient nearby. Thank you!',
                };
            }
        }
        return invalid;
    }

    const committed = !!donor.committed_until && Date.parse(donor.committed_until) > now;
    const eligibleFrom = eligibleFromMs(donor);
    const describe = (m: NetMatch) => m.urgency + ' ' + m.request_blood_group + ' - ' + m.hospital_name + (m.distance_km != null ? ' (' + m.distance_km + ' km)' : '');

    if (steps.length === 0) {
        return {
            action: 'none',
            reply: 'CON Welcome ' + (donor.source === 'ussd' ? 'back' : firstName(donor.name, 'donor')) + ' (' + donor.blood_group + ' donor)\n1. Blood requests for you ('
                + alerts.length + ')\n2. My eligibility\n3. Alerts: ' + (donor.available ? 'ON' : 'OFF'),
        };
    }
    if (steps[0] === '1') {
        const m = steps.length >= 2 ? alerts[Number(steps[1]) - 1] : undefined;
        if (steps.length === 1) {
            return {
                action: 'none',
                reply: alerts.length
                    ? 'CON Requests needing you:\n' + alerts.map((a, i) => (i + 1) + '. ' + describe(a)).join('\n')
                    : 'END No blood requests need you right now. Thank you for staying available!',
            };
        }
        if (m && steps.length === 2) {
            return { action: 'none', reply: 'CON ' + m.hospital_name + ' (' + m.hospital_city + ') needs ' + m.request_blood_group + ' blood (' + m.urgency + ').\n1. Yes, I can donate today\n2. No, not this time' };
        }
        if (m && steps.length === 3 && ['1', '2'].includes(steps[2]!)) {
            return { action: 'respond', reply: '', respond: { match_id: m.id, token: m.response_token, action: steps[2] === '1' ? 'accept' : 'decline', hospital_name: m.hospital_name } };
        }
        return invalid;
    }
    if (steps[0] === '2' && steps.length === 1) {
        return {
            action: 'none',
            reply: 'END ' + donor.blood_group + ' donor. '
                + (donor.last_donation_date ? 'Last donation ' + dmy(donor.last_donation_date) + '. ' : 'No donation recorded yet. ')
                + (committed ? 'You are booked for a request today.'
                    : eligibleFrom && eligibleFrom > now ? 'You can donate again from ' + dmy(new Date(eligibleFrom).toISOString()) + '.'
                        : 'You can donate now.'),
        };
    }
    if (steps[0] === '3') {
        if (steps.length === 1) return { action: 'none', reply: 'CON Alerts are ' + (donor.available ? 'ON' : 'OFF') + '.\n1. Turn alerts ON\n2. Turn alerts OFF' };
        if (steps.length === 2 && ['1', '2'].includes(steps[1]!)) {
            return {
                action: 'set_availability',
                availability: { id: donor.id, available: steps[1] === '1' },
                reply: steps[1] === '1'
                    ? 'END Alerts turned ON. We will text you when your blood is needed nearby.'
                    : 'END Alerts turned OFF. Dial again to turn them back on.',
            };
        }
    }
    return invalid;
};

/** The reply after a donor answers a request by USSD (same outcomes as the one-tap links). */
export const ussdOutcomeReply = (outcome: string, hospitalName: string) => ({
    accepted: 'END Thank you! ' + hospitalName + ' has been told you are coming. Please carry a photo ID.',
    declined: 'END Thanks for letting us know. We will ask another donor.',
    withdrawn: 'END Thanks for letting us know. The hospital has been told.',
    not_needed: 'END Thank you! Enough donors have already confirmed for this request.',
    committed_elsewhere: 'END You are already booked for another request. Thank you!',
    already_accepted: 'END You are already confirmed. Thank you!',
    already_declined: 'END Noted. Thank you.',
} as Record<string, string>)[outcome] ?? 'END Sorry, we could not record your reply. Please try again.';
