import { createHmac, hkdfSync, randomInt, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * "Forgot password": a 6-digit code sent by email, valid once, for 15 minutes,
 * with 5 tries. Only a keyed hash of the code is stored, so the database alone
 * does not reveal it. A correct code earns a 15-minute ticket that carries the
 * reset through its last steps (the authenticator code for admins and hospitals,
 * then the new password).
 */
export const RESET_CODE_MINUTES = 15;
export const RESET_CODE_TRIES = 5;

// Keys derived from JWT_SECRET, each for one purpose only
const derivedKey = (purpose: string): Buffer => {
    const root = process.env.JWT_SECRET;
    if (!root) throw new Error('JWT_SECRET is not set');
    return Buffer.from(hkdfSync('sha256', root, 'lifelink-password-reset', purpose, 32));
};

export const newResetCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashResetCode = (resetId: string, code: string): string =>
    createHmac('sha256', derivedKey('code-v1')).update(`${resetId}:${code}`).digest('hex');

export const resetCodeMatches = (resetId: string, code: string, storedHex: string): boolean => {
    const given = Buffer.from(hashResetCode(resetId, code.replace(/\s/g, '')), 'hex');
    const stored = Buffer.from(String(storedHex), 'hex');
    return given.length === stored.length && timingSafeEqual(given, stored);
};

export interface ResetTicket { rid: string; uid: number }

/** Signed with its own key, so a reset ticket can never pass as a session. */
export const signResetTicket = (rid: string, uid: number): string =>
    jwt.sign({ rid, uid }, derivedKey('ticket-v1'), { expiresIn: `${RESET_CODE_MINUTES}m` });

export const readResetTicket = (token: unknown): ResetTicket | null => {
    if (typeof token !== 'string') return null;
    try {
        const t = jwt.verify(token, derivedKey('ticket-v1')) as any;
        return typeof t?.rid === 'string' && Number.isInteger(t.uid) ? { rid: t.rid, uid: t.uid } : null;
    } catch {
        return null;
    }
};
