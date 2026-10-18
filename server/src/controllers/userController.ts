import { Response } from 'express';
import bcrypt from 'bcrypt';
import pool, { query } from '../config/db';
import { AuthRequest, forgetAccountCheck } from '../middleware/authMiddleware';
import { sessionToken } from '../middleware/session';
import { blacklistToken } from '../middleware/securityMiddleware';
import { authCookieOptions, sessionCookieName } from '../utils/authCookie';
import { keepCookieName, keepCookieOptions } from '../utils/keepSignedIn';
import { respond } from '../network/engine';

const SESSION_MS = 30 * 60 * 1000;

/**
 * DELETE /user/account  { password }
 * A donor deletes their account and the personal data LifeLink holds about
 * them (withdrawing consent and erasure, DPDP Act 2023). Requests they were
 * alerted for or had said YES to are handed to the next donors first, so no
 * hospital waits for someone who is gone. What remains is anonymous: request
 * history keeps "a donor" with no name or contact. Hospital and admin accounts
 * are closed by LifeLink, so their records stay accountable.
 */
export const deleteAccount = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    try {
        const user = (await query(
            `SELECT u.id, u.role, u.email, u.password_hash, d.phone FROM users u LEFT JOIN donors d ON d.user_id = u.id WHERE u.id = $1`,
            [userId]
        )).rows[0];
        if (!user) return res.status(404).json({ message: 'Account not found.' });
        if (user.role !== 'donor') {
            return res.status(403).json({ message: 'Hospital and admin accounts are closed by LifeLink. Contact us from the Support page.' });
        }
        // 403, not 401: the website reads 401 as "session over" and would sign the donor out
        if (!(await bcrypt.compare(String(req.body.password), user.password_hash))) {
            return res.status(403).json({ message: 'That password is not right.', error: 'wrong_password' });
        }

        // Stand down first: the same as tapping NO, so the next donors are alerted
        const entry = (await query('SELECT id, phone FROM network_donors WHERE user_id = $1', [userId])).rows[0];
        if (entry) {
            const active = (await query(
                `SELECT id, response_token FROM network_matches WHERE donor_id = $1 AND status IN ('notified', 'accepted')`,
                [entry.id]
            )).rows;
            for (const m of active) await respond({ m: String(m.id), t: m.response_token, a: 'decline', format: 'json' });
        }

        const contacts = [entry?.phone, user.phone, String(user.email).toLowerCase()].filter(Boolean);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (entry) {
                // Request history stays for hospitals, without the donor's contact
                await client.query('UPDATE network_matches SET contact = NULL WHERE donor_id = $1', [entry.id]);
                await client.query('DELETE FROM network_notifications WHERE donor_id = $1', [entry.id]);
            }
            await client.query('DELETE FROM network_outbox WHERE lower(recipient) = ANY($1::text[])', [contacts.map((c) => c.toLowerCase())]);
            await client.query('DELETE FROM campaign_registrations WHERE donor_user_id = $1 OR lower(email) = lower($2)', [userId, user.email]);
            // Everything else goes with the account: donor profile, network entry,
            // donations, certificates, live locations, reviews, sign-ins
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => { });
            throw err;
        } finally {
            client.release();
        }

        forgetAccountCheck(userId);
        const token = sessionToken(req);
        if (token) blacklistToken(token, SESSION_MS);
        res.clearCookie(sessionCookieName('donor'), authCookieOptions());
        res.clearCookie(keepCookieName('donor'), keepCookieOptions());
        console.info(`Donor account ${userId} deleted by its owner`);
        res.json({ deleted: true });
    } catch (err: any) {
        console.error('Account deletion failed:', err?.message ?? err);
        res.status(500).json({ message: 'Could not delete the account. Please try again.' });
    }
};
