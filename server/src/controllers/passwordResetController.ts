import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { query } from '../config/db';
import { sendAccountEmail } from '../services/donorNetwork';
import { SECOND_STEP_ROLES, twoStepRecord, useSecondStepCode } from '../services/twoStep';
import { endAllKeptSessions } from '../utils/keepSignedIn';
import {
    RESET_CODE_MINUTES, RESET_CODE_TRIES, hashResetCode, newResetCode, readResetTicket, resetCodeMatches, signResetTicket,
} from '../utils/passwordReset';
import { bruteForceDelay, clearFailedAttempts, logSecurityEvent, recordFailedAttempt } from '../middleware/securityMiddleware';

/**
 * Forgot password (utils/passwordReset):
 *   1. POST /auth/password/forgot       { email }        a code is emailed if the account exists
 *   2. POST /auth/password/verify       { email, code }  → { token, second_step }
 *   3. POST /auth/password/second-step  { token, code }  admins and hospitals: the authenticator code
 *   4. POST /auth/password/reset        { token, password }
 * The answers never reveal whether an email has an account.
 */

/** Step 1 always takes at least this long, so its timing does not reveal whether an account exists. */
export const resetTiming = { minimumMs: 900 };

const SENT = { message: 'If that email belongs to a LifeLink account, we have sent it a 6-digit code.' };
const ENDED = { message: 'This password reset has timed out. Please start again.', error: 'reset_expired' };
const ipOf = (req: Request) => req.ip || req.socket?.remoteAddress || 'unknown';
const twoStepOn = async (role: string, userId: number) => SECOND_STEP_ROLES.has(role) && !!(await twoStepRecord(userId))?.enabled;

/** The account's newest reset, while it can still be used. */
const openReset = async (rid: string, uid: number) => (await query(
    `SELECT r.id, r.user_id, r.verified_at, r.second_step_at, u.email, u.name, u.role, u.password_hash
     FROM password_resets r JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2 AND r.used_at IS NULL AND r.expires_at > now()
       AND r.id = (SELECT id FROM password_resets WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1)`,
    [rid, uid])).rows[0];

export const forgotPassword = async (req: Request, res: Response) => {
    const started = Date.now();
    const email = String(req.body.email).trim().toLowerCase();
    try {
        const user = (await query('SELECT id, name, email, role FROM users WHERE lower(email) = $1', [email])).rows[0];
        if (user) {
            // At most one code a minute and five an hour, so nobody can flood an inbox
            const recent = (await query(
                `SELECT count(*)::int AS last_hour, max(created_at) AS latest
                 FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'`, [user.id])).rows[0];
            const tooSoon = !!recent?.latest && Date.now() - new Date(recent.latest).getTime() < 60_000;
            if (!tooSoon && Number(recent?.last_hour ?? 0) < 5) {
                const id = randomUUID();
                const code = newResetCode();
                await query(
                    'INSERT INTO password_resets (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
                    [id, user.id, hashResetCode(id, code), new Date(Date.now() + RESET_CODE_MINUTES * 60_000)]);
                await sendAccountEmail({
                    type: 'reset_code', to: user.email, name: user.name, code, minutes: RESET_CODE_MINUTES,
                    needs_authenticator: await twoStepOn(user.role, user.id),
                }).catch((err: any) => console.error('Password reset email failed:', err.message));
            }
        }
    } catch (err: any) {
        console.error('forgotPassword failed:', err.message);
        return res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
    // The same answer, after about the same time, whether or not the account exists
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, resetTiming.minimumMs - (Date.now() - started))));
    res.json(SENT);
};

export const verifyResetCode = async (req: Request, res: Response) => {
    const email = String(req.body.email).trim().toLowerCase();
    const code = String(req.body.code).replace(/\s/g, '');
    try {
        const reset = (await query(
            `SELECT r.id, r.user_id, r.code_hash, r.expires_at, r.used_at, u.role
             FROM password_resets r JOIN users u ON u.id = r.user_id
             WHERE lower(u.email) = $1 ORDER BY r.created_at DESC LIMIT 1`, [email])).rows[0];
        if (!reset || reset.used_at || new Date(reset.expires_at).getTime() <= Date.now()) {
            return res.status(400).json({ message: 'This code has expired. Ask for a new one.', error: 'reset_code_expired' });
        }
        // Count the try before checking, so parallel guesses cannot pass the limit
        const counted = (await query(
            'UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1 AND attempts < $2 RETURNING attempts',
            [reset.id, RESET_CODE_TRIES])).rows[0];
        if (!counted) return res.status(400).json({ message: 'Too many wrong tries. Ask for a new code.', error: 'reset_code_locked' });
        if (!resetCodeMatches(reset.id, code, reset.code_hash)) {
            recordFailedAttempt(ipOf(req));
            logSecurityEvent('BRUTE_FORCE', req, 'Wrong password reset code');
            const left = RESET_CODE_TRIES - Number(counted.attempts);
            return res.status(400).json(left > 0
                ? { message: `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, error: 'reset_code_wrong' }
                : { message: 'Too many wrong tries. Ask for a new code.', error: 'reset_code_locked' });
        }
        await query('UPDATE password_resets SET verified_at = coalesce(verified_at, now()) WHERE id = $1', [reset.id]);
        res.json({ token: signResetTicket(reset.id, reset.user_id), second_step: await twoStepOn(reset.role, reset.user_id) });
    } catch (err: any) {
        console.error('verifyResetCode failed:', err.message);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/** Admins and hospitals: the email code alone cannot change the password. */
export const confirmResetSecondStep = async (req: Request, res: Response) => {
    const ticket = readResetTicket(req.body.token);
    if (!ticket) return res.status(401).json(ENDED);
    await bruteForceDelay(req, res, () => { });
    try {
        const reset = await openReset(ticket.rid, ticket.uid);
        if (!reset?.verified_at) return res.status(401).json(ENDED);
        const mfa = await twoStepRecord(ticket.uid);
        if (!SECOND_STEP_ROLES.has(reset.role) || !mfa?.enabled) return res.json({ ok: true });
        const checked = await useSecondStepCode(ticket.uid, String(req.body.code), mfa);
        if (!checked.ok) {
            recordFailedAttempt(ipOf(req));
            logSecurityEvent('BRUTE_FORCE', req, 'Wrong authenticator code during a password reset');
            return res.status(401).json({
                message: 'That code is not right. Enter the newest code from your authenticator app, or a backup code.',
                error: 'mfa_wrong_code',
            });
        }
        await query('UPDATE password_resets SET second_step_at = now() WHERE id = $1', [reset.id]);
        res.json({ ok: true, ...(checked.backupCodesLeft !== undefined ? { backup_codes_left: checked.backupCodesLeft } : {}) });
    } catch (err: any) {
        console.error('confirmResetSecondStep failed:', err.message);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const ticket = readResetTicket(req.body.token);
    if (!ticket) return res.status(401).json(ENDED);
    const password = String(req.body.password);
    try {
        const reset = await openReset(ticket.rid, ticket.uid);
        if (!reset?.verified_at) return res.status(401).json(ENDED);
        if (await twoStepOn(reset.role, reset.user_id) && !reset.second_step_at) {
            return res.status(403).json({ message: 'Enter the code from your authenticator app first.', error: 'reset_second_step' });
        }
        if (await bcrypt.compare(password, reset.password_hash)) {
            return res.status(400).json({ message: 'Choose a new password, not the one you have now.', error: 'same_password' });
        }
        // Each reset works once
        const claimed = (await query('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id', [reset.id])).rows[0];
        if (!claimed) return res.status(401).json(ENDED);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 12), reset.user_id]);
        // Whoever knew the old password is signed out too, on every device
        await endAllKeptSessions(reset.user_id);
        clearFailedAttempts(ipOf(req));
        await sendAccountEmail({
            type: 'password_changed', to: reset.email, name: reset.name,
            when: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
        }).catch((err: any) => console.error('Password changed email failed:', err.message));
        res.json({ message: 'Your password has been changed. Sign in with your new password.', email: reset.email });
    } catch (err: any) {
        console.error('resetPassword failed:', err.message);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};
