import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { CookieOptions } from 'express';
import { query } from '../config/db';
import { SessionRole, authCookieOptions } from './authCookie';

/**
 * "Keep me signed in". The session cookie (a JWT) still lasts 30 minutes. Beside
 * it, signing in stores a random token, and POST /auth/refresh trades that for a
 * new session cookie, so the app and the site stay signed in without asking for
 * the password (or the authenticator code) again.
 *
 * - Kept (the app, or "Keep me signed in" ticked): renews for 30 days from the
 *   last use, and ends 90 days after signing in.
 * - Not kept (a shared computer): ends when the browser closes, at most 12 hours.
 *
 * Only a hash of the token is stored. The cookie is HttpOnly and only sent to
 * /auth/*, and the token is ended by signing out, by removing an admin's access
 * and by a two-step verification reset.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const KEEP_IDLE_MS = 30 * DAY_MS;
export const KEEP_MAX_MS = 90 * DAY_MS;
export const BROWSER_SESSION_MS = 12 * 60 * 60 * 1000;

export const keepCookieName = (role: SessionRole) => `ll_${role}_keep`;

/** Options for the token's cookie; without maxAge it ends when the browser closes. */
export const keepCookieOptions = (maxAgeMs?: number): CookieOptions => ({
    ...authCookieOptions(),
    path: '/auth',
    ...(maxAgeMs !== undefined ? { maxAge: Math.max(0, Math.floor(maxAgeMs)) } : {}),
});

export interface KeptSession {
    value: string;
    persistent: boolean;
    expiresAt: Date;
}

/** How long the cookie should live: as long as the session, or the browser session. */
export const keepCookieMaxAge = (session: KeptSession): number | undefined =>
    session.persistent ? session.expiresAt.getTime() - Date.now() : undefined;

const hashSecret = (secret: string): Buffer => createHash('sha256').update(secret).digest();

// <session id>.<secret>: the id finds the row, the secret proves the holder
const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
const parseToken = (value: unknown): { id: string; secret: string } | null => {
    if (typeof value !== 'string') return null;
    const match = TOKEN.exec(value);
    return match ? { id: match[1]!, secret: match[2]! } : null;
};

export const startKeptSession = async (
    userId: number, role: SessionRole, persistent: boolean, userAgent?: string,
): Promise<KeptSession> => {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (persistent ? KEEP_IDLE_MS : BROWSER_SESSION_MS));
    // Tidy this account's ended sign-ins while adding the new one
    await query('DELETE FROM user_sessions WHERE user_id = $1 AND (revoked_at IS NOT NULL OR expires_at < now())', [userId]);
    await query(
        `INSERT INTO user_sessions (id, user_id, role, token_hash, persistent, expires_at, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId, role, hashSecret(secret).toString('hex'), persistent, expiresAt, userAgent ? userAgent.slice(0, 300) : null]);
    return { value: `${id}.${secret}`, persistent, expiresAt };
};

/** The account behind a kept-session token, with its expiry moved on; null once it has ended. */
export const resumeKeptSession = async (
    value: unknown, role: SessionRole,
): Promise<{ user: { id: number; name: string; email: string; role: string }; session: KeptSession } | null> => {
    const token = parseToken(value);
    if (!token) return null;
    const row = (await query(
        `SELECT s.user_id, s.role, s.token_hash, s.persistent, s.created_at, s.expires_at, s.revoked_at,
                u.name, u.email, u.role AS user_role
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1`, [token.id])).rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
    if (row.role !== role || row.user_role !== role) return null;
    const stored = Buffer.from(String(row.token_hash), 'hex');
    const given = hashSecret(token.secret);
    if (stored.length !== given.length || !timingSafeEqual(stored, given)) return null;

    const expiresAt = row.persistent
        ? new Date(Math.min(Date.now() + KEEP_IDLE_MS, new Date(row.created_at).getTime() + KEEP_MAX_MS))
        : new Date(row.expires_at);
    await query('UPDATE user_sessions SET last_used_at = now(), expires_at = $2 WHERE id = $1', [token.id, expiresAt]);
    return {
        user: { id: row.user_id, name: row.name, email: row.email, role: row.user_role },
        session: { value: value as string, persistent: !!row.persistent, expiresAt },
    };
};

/** Ends one kept sign-in (signing out); only the token's holder can end it. */
export const endKeptSession = async (value: unknown): Promise<void> => {
    const token = parseToken(value);
    if (!token) return;
    await query(
        'UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL',
        [token.id, hashSecret(token.secret).toString('hex')]);
};

/** Ends every kept sign-in of an account, on all its devices. */
export const endAllKeptSessions = async (userId: number): Promise<void> => {
    await query('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
};
