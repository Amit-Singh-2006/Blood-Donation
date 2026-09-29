import { createHash, randomInt } from 'crypto';

// No 0/O or 1/I/L, so codes read out over the phone are not mistyped
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LENGTH = 4;

/** A new invite code such as LL-7KQM-X2PD-9RTA-HC4W (about 79 bits of randomness). */
export const generateInviteCode = (): string => {
    const groups: string[] = [];
    for (let g = 0; g < GROUPS; g++) {
        let group = '';
        for (let i = 0; i < GROUP_LENGTH; i++) group += ALPHABET[randomInt(ALPHABET.length)];
        groups.push(group);
    }
    return ['LL', ...groups].join('-');
};

/**
 * Canonical form of what someone typed: case, spaces and dashes do not matter.
 * Returns null when it cannot be an invite code at all.
 */
export const normalizeInviteCode = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const compact = input.toUpperCase().replace(/[\s-]/g, '');
    const body = compact.startsWith('LL') ? compact.slice(2) : compact;
    if (body.length !== GROUPS * GROUP_LENGTH || [...body].some((c) => !ALPHABET.includes(c))) return null;
    return 'LL-' + body.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-');
};

/** Only this hash is stored, so a database leak does not reveal usable codes. */
export const hashInviteCode = (code: string): string => createHash('sha256').update(code).digest('hex');

export type InviteStatus = 'pending' | 'used' | 'revoked' | 'expired';

export const inviteStatus = (invite: { used_at?: unknown; revoked_at?: unknown; expires_at: string | Date }, now = Date.now()): InviteStatus => {
    if (invite.used_at) return 'used';
    if (invite.revoked_at) return 'revoked';
    if (new Date(invite.expires_at).getTime() <= now) return 'expired';
    return 'pending';
};
