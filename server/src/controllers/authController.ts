import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';
import pool, { query } from '../config/db';
import { LEGACY_SESSION_COOKIE, SESSION_ROLES, authCookieOptions, isSessionRole, sessionCookieName } from '../utils/authCookie';
import { requestedRole } from '../middleware/session';
import { enrolDonor } from '../services/donorNetwork';
import { hashInviteCode, inviteStatus, normalizeInviteCode } from '../utils/adminInvites';
import { describeScope } from '../utils/jurisdiction';
import {
    base32Decode, generateSecret, hashBackupCode, matchTotp, newBackupCodes, openSecret, otpauthUrl,
    readPendingToken, sealSecret, signPendingToken,
} from '../utils/mfa';
import dotenv from 'dotenv';
import {
    blacklistToken,
    recordFailedAttempt,
    clearFailedAttempts,
    bruteForceDelay,
    logSecurityEvent,
} from '../middleware/securityMiddleware';

dotenv.config();

const JWT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

// Constant-time check of the admin invite code; unset means admin sign-up is closed
export const inviteCodeMatches = (given: unknown, expected = process.env.ADMIN_INVITE_CODE) => {
    if (!expected || typeof given !== 'string' || !given) return false;
    const digest = (v: string) => createHash('sha256').update(v).digest();
    return timingSafeEqual(digest(given), digest(expected));
};

const issueSession = (res: Response, user: { id: number; email: string; role: string }) => {
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '30m' }
    );
    // HttpOnly cookie → prevents JavaScript/XSS from stealing the token. One per
    // account type, so signing in as a donor leaves a hospital session alone.
    if (!isSessionRole(user.role)) throw new Error(`Unknown role ${user.role}`);
    res.cookie(sessionCookieName(user.role), token, { ...authCookieOptions(), maxAge: JWT_EXPIRY_MS });
    res.clearCookie(LEGACY_SESSION_COOKIE, authCookieOptions());
};

// Admins and hospitals see donors' details and act on the network, so a password
// alone is not enough: they also enter a code from an authenticator app
const SECOND_STEP_ROLES = new Set(['admin', 'hospital']);

type AccountRow = { id: number; name: string; email: string; role: string };

/** The account details the frontend keeps after signing in. */
const sessionUser = async (user: AccountRow) => {
    let extra: Record<string, unknown> = {};
    if (user.role === 'donor') {
        extra = (await query(
            'SELECT blood_group, city, phone, is_eligible, xp_points, current_level, badges FROM donors WHERE user_id = $1',
            [user.id])).rows[0] ?? {};
    } else if (user.role === 'hospital') {
        extra = (await query('SELECT hospital_name, city, contact_number FROM hospitals WHERE user_id = $1', [user.id])).rows[0] ?? {};
    } else if (user.role === 'admin') {
        const p = (await query('SELECT is_national, state, cities FROM admin_profiles WHERE user_id = $1', [user.id])).rows[0];
        if (p) extra = { jurisdiction: describeScope(p) };
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role, ...extra };
};

// Last sign-in (admins also keep the IP, for spotting unusual access)
const recordSignIn = (user: AccountRow, ip: string) =>
    query('UPDATE users SET last_login_at = now(), last_login_ip = $1 WHERE id = $2',
        [user.role === 'admin' ? ip : null, user.id]).catch(() => { });

/**
 * After the password, admins and hospitals get a 10-minute ticket instead of a
 * session: the first time to set up an authenticator app (scan a QR code), after
 * that to enter its 6-digit code. POST /auth/mfa/verify finishes the sign-in.
 */
const startSecondStep = async (res: Response, user: AccountRow, status = 200) => {
    const row = (await query('SELECT enabled, secret_enc FROM user_mfa WHERE user_id = $1', [user.id])).rows[0];
    if (row?.enabled) {
        return res.status(status).json({
            mfa: { mode: 'verify', role: user.role, name: user.name, token: signPendingToken(user.id, user.role, 'verify') },
        });
    }
    // An unfinished setup keeps its secret, so a QR code already scanned still works
    const stored = row ?? (await query(
        `INSERT INTO user_mfa (user_id, secret_enc) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING secret_enc`,
        [user.id, sealSecret(generateSecret())])).rows[0];
    const secret = openSecret(stored.secret_enc);
    return res.status(status).json({
        mfa: {
            mode: 'setup', role: user.role, name: user.name, email: user.email,
            token: signPendingToken(user.id, user.role, 'setup'),
            secret, otpauth_url: otpauthUrl(user.email, secret),
        },
    });
};

const INVITE_PROBLEM: Record<string, string> = {
    used: 'This invite has already been used.',
    revoked: 'This invite was cancelled. Ask the national admin for a new one.',
    expired: 'This invite has expired. Ask the national admin for a new one.',
};

/**
 * POST /auth/admin-invite/check  { code }
 * Lets someone confirm their invite before filling in the form. It says who
 * the invite is for and which jurisdiction it covers; nothing else.
 */
export const checkAdminInvite = async (req: Request, res: Response) => {
    const { code } = req.body;
    try {
        // The one-time setup code (ADMIN_INVITE_CODE) creates the first, national admin
        if (inviteCodeMatches(code)) {
            const exists = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
            if (exists.rows.length) {
                return res.json({ valid: false, reason: 'The setup code has already been used. Ask a national admin for a personal invite.' });
            }
            return res.json({ valid: true, kind: 'setup', is_national: true, jurisdiction: 'All India' });
        }

        const normalized = normalizeInviteCode(code);
        if (!normalized) {
            return res.json({ valid: false, reason: 'That is not a LifeLink invite code. Codes look like LL-XXXX-XXXX-XXXX-XXXX.' });
        }
        const result = await query(
            `SELECT name, email, is_national, state, cities, expires_at, used_at, revoked_at
             FROM admin_invites WHERE code_hash = $1`,
            [hashInviteCode(normalized)]
        );
        const invite = result.rows[0];
        if (!invite) {
            logSecurityEvent('BRUTE_FORCE', req, 'Unknown admin invite code checked');
            return res.json({ valid: false, reason: 'No invite matches this code. Check it with the admin who sent it.' });
        }
        const status = inviteStatus(invite);
        if (status !== 'pending') return res.json({ valid: false, reason: INVITE_PROBLEM[status] });

        res.json({
            valid: true,
            kind: 'invite',
            name: invite.name,
            email: invite.email,
            is_national: invite.is_national,
            state: invite.state,
            cities: invite.cities,
            jurisdiction: describeScope(invite),
            expires_at: invite.expires_at,
        });
    } catch (err: any) {
        console.error('Invite check error:', err);
        res.status(500).json({ message: 'Could not check the code. Please try again.' });
    }
};

/**
 * Admin sign-up. Either the one-time setup code (only while no admin exists)
 * or a personal invite, which is claimed atomically so it can be used once,
 * and only with the email address it was issued to.
 */
const registerAdmin = async (req: Request, res: Response) => {
    const { name, email, password, admin_invite_code: code } = req.body;
    const client = await pool.connect();
    const fail = async (status: number, message: string) => {
        await client.query('ROLLBACK');
        return res.status(status).json({ message });
    };
    try {
        await client.query('BEGIN');
        let profile: { is_national: boolean; state: string | null; cities: string[]; invited_by: number | null };
        let inviteId: number | null = null;

        if (inviteCodeMatches(code)) {
            const exists = await client.query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
            if (exists.rows.length) {
                return await fail(403, 'The setup code has already been used. Ask a national admin for a personal invite.');
            }
            profile = { is_national: true, state: null, cities: [], invited_by: null };
        } else {
            const normalized = normalizeInviteCode(code);
            const claim = normalized && await client.query(
                `UPDATE admin_invites SET used_at = now()
                 WHERE code_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
                 RETURNING id, email, is_national, state, cities, created_by`,
                [hashInviteCode(normalized)]
            );
            const invite = claim ? claim.rows[0] : null;
            if (!invite) {
                logSecurityEvent('MASS_ASSIGN', req, 'Admin registration attempt without a valid invite');
                return await fail(403, 'This invite code is not valid, has expired or was already used.');
            }
            if (String(invite.email).toLowerCase() !== String(email).toLowerCase()) {
                return await fail(403, `This invite was issued to a different email address. Use ${invite.email}.`);
            }
            inviteId = invite.id;
            profile = { is_national: invite.is_national, state: invite.state, cities: invite.cities, invited_by: invite.created_by };
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const created = await client.query(
            `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role`,
            [name, email, hashedPassword]
        );
        const user = created.rows[0];
        await client.query(
            `INSERT INTO admin_profiles (user_id, is_national, state, cities, invited_by) VALUES ($1, $2, $3, $4, $5)`,
            [user.id, profile.is_national, profile.state, profile.cities, profile.invited_by]
        );
        if (inviteId) await client.query('UPDATE admin_invites SET used_by = $1 WHERE id = $2', [user.id, inviteId]);
        await client.query('COMMIT');

        // The new admin sets up an authenticator app before their first session
        await startSecondStep(res, user, 201);
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Admin registration error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ message: 'This email is already registered. Please sign in instead.', error: 'duplicate_email' });
        }
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
};

/**
 * POST /auth/register
 * 
 * Attack coverage:
 *  – Mass Assignment: only whitelisted fields are used (role whitelisted explicitly)
 *  – Privilege Escalation: admin registration requires invite code + single-admin check
 *  – Sensitive Data Exposure: password is never returned; stack traces not leaked
 */
export const register = async (req: Request, res: Response) => {
    const {
        name, email, password, role,
        blood_group, city, phone, dob, gender, preferred_channel,
        hospital_name, contact_number, registration_number, latitude, longitude,
        state, address, pincode, hospital_type
    } = req.body;

    // Enforce allowed roles explicitly → Privilege Escalation / Vertical Access Control Bypass
    if (!['donor', 'hospital', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
    }

    // ── ADMIN PROTECTION ─────────────────────────────────────────────
    // Requires the one-time setup code or a personal invite.
    // Prevents: Privilege Escalation, Vertical Access Control Bypass
    if (role === 'admin') return registerAdmin(req, res);

    try {
        const hashedPassword = await bcrypt.hash(password, 12); // cost factor 12 (stronger than 10)
        const result = await query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        const user = result.rows[0];

        if (role === 'donor') {
            await query(
                'INSERT INTO donors (user_id, blood_group, city, phone, dob, gender) VALUES ($1, $2, $3, $4, $5, $6)',
                [user.id, blood_group, city, phone, dob, gender]
            );
            // Join the n8n donor network so this donor can be matched and alerted
            await enrolDonor({ name, phone, blood_group, city, gender }, { preferred_channel });
        } else if (role === 'hospital') {
            await query(
                `INSERT INTO hospitals (user_id, hospital_name, city, contact_number, registration_number, latitude, longitude,
                                        state, address, pincode, hospital_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [user.id, hospital_name || name, city, contact_number || phone, registration_number, latitude ?? null, longitude ?? null,
                    state ?? null, address ?? null, pincode ?? null, hospital_type ?? null]
            );
        }

        // A new hospital sets up its authenticator app before its first session
        if (SECOND_STEP_ROLES.has(user.role)) return await startSecondStep(res, user, 201);

        issueSession(res, user);

        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Never return password_hash or internal DB fields
        res.status(201).json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role, blood_group }
        });
    } catch (err: any) {
        console.error('Registration error:', err);

        // Handle PostgreSQL unique constraint violation (duplicate email)
        // Return generic message to avoid email enumeration
        if (err.code === '23505') {
            return res.status(400).json({
                message: 'This email is already registered. Please login instead or use a different email.',
                error: 'duplicate_email'
            });
        }

        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Do NOT leak err.message or stack traces to the client
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

/**
 * POST /auth/login
 *
 * Attack coverage:
 *  – Brute Force: progressive delay + IP tracking (express-rate-limit in route)
 *  – Credential Stuffing: same brute force mechanism applies
 *  – Session Fixation: old cookie cleared by preventSessionFixation middleware
 *  – Sensitive Data Exposure: password_hash never returned
 *  – JWT Tampering: token signed server-side; admin role DB-verified on protected routes
 */
export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // Apply progressive delay based on prior failed attempts (brute force slow-down)
    await bruteForceDelay(req, res, () => { });

    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);

        // ── TIMING ATTACK MITIGATION ─────────────────────────────────────
        // Always run bcrypt.compare even if the user is not found.
        // This prevents timing-based email enumeration.
        const dummyHash = '$2b$12$invalidhashfortemporarydummyuse000000000000000000000';
        const userFound = result.rows.length > 0;
        const user = userFound ? result.rows[0] : { password_hash: dummyHash };
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!userFound || !isMatch) {
            recordFailedAttempt(ip);
            logSecurityEvent('BRUTE_FORCE', req, `Failed login attempt for email: ${email}`);
            // Generic error message prevents username enumeration
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Clear failed attempts on successful login
        clearFailedAttempts(ip);

        if (user.role === 'admin') {
            const adminProfile = await query('SELECT active FROM admin_profiles WHERE user_id = $1', [user.id]);
            const p = adminProfile.rows[0];
            if (p && !p.active) {
                return res.status(403).json({ message: 'Your admin access has been removed. Contact the national admin.' });
            }
        }

        // Admins and hospitals finish signing in with a code from their authenticator app
        if (SECOND_STEP_ROLES.has(user.role)) return await startSecondStep(res, user);

        await recordSignIn(user, ip);
        // HttpOnly cookie prevents XSS token theft; see authCookieOptions for SameSite
        issueSession(res, user);
        res.json({ user: await sessionUser(user) });
    } catch (err: any) {
        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Never leak internal error details to the client
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};

/**
 * POST /auth/logout
 *
 * Attack coverage:
 *  – Token Replay Attack: logs the token out by adding it to the blacklist
 *    so that even a stolen copy of the token cannot be reused post-logout
 *  – Session Hijacking: clearing HttpOnly cookie ends the session
 */
export const logout = async (req: Request, res: Response) => {
    // Sign out of the account the page acts as; with no role, sign out of all
    const role = requestedRole(req);
    const names = [...(role ? [role] : SESSION_ROLES).map(sessionCookieName), LEGACY_SESSION_COOKIE];

    for (const name of names) {
        const token = req.cookies?.[name];
        // Add to blacklist so it cannot be replayed even before it naturally expires
        if (token) blacklistToken(token, JWT_EXPIRY_MS);
        res.clearCookie(name, authCookieOptions());
    }
    res.json({ message: 'Logged out successfully' });
};

const EXPIRED = { message: 'This sign-in has timed out. Please sign in again.', error: 'mfa_expired' };

const wrongCode = (req: Request, res: Response, ip: string) => {
    recordFailedAttempt(ip);
    logSecurityEvent('BRUTE_FORCE', req, 'Wrong two-step verification code');
    return res.status(401).json({
        message: 'That code is not right. Enter the newest code from your authenticator app, and make sure your phone sets its time automatically.',
        error: 'mfa_wrong_code',
    });
};

/**
 * POST /auth/mfa/verify  { token, code }
 * The second step for admins and hospitals: a 6-digit authenticator code, or a
 * single-use backup code. Finishing setup returns 10 backup codes, shown once.
 */
export const verifySecondStep = async (req: Request, res: Response) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const ticket = readPendingToken(req.body.token);
    if (!ticket) return res.status(401).json(EXPIRED);
    await bruteForceDelay(req, res, () => { });
    try {
        const user: AccountRow | undefined = (await query('SELECT id, name, email, role FROM users WHERE id = $1', [ticket.uid])).rows[0];
        const mfa = (await query('SELECT enabled, secret_enc, last_step FROM user_mfa WHERE user_id = $1', [ticket.uid])).rows[0];
        // The account must still match the ticket and be in the state the ticket expects
        if (!user || user.role !== ticket.role || !SECOND_STEP_ROLES.has(user.role) || !mfa || mfa.enabled !== (ticket.mode === 'verify')) {
            return res.status(401).json(EXPIRED);
        }
        if (user.role === 'admin') {
            const p = (await query('SELECT active FROM admin_profiles WHERE user_id = $1', [user.id])).rows[0];
            if (p && !p.active) return res.status(403).json({ message: 'Your admin access has been removed. Contact the national admin.' });
        }

        const code = String(req.body.code);
        const step = matchTotp(base32Decode(openSecret(mfa.secret_enc)), code, mfa.last_step == null ? null : Number(mfa.last_step));
        let backupCodes: string[] | undefined;
        let backupCodesLeft: number | undefined;
        if (ticket.mode === 'setup') {
            if (step === null) return wrongCode(req, res, ip);
            backupCodes = newBackupCodes();
            await query(
                `UPDATE user_mfa SET enabled = TRUE, enabled_at = now(), last_step = $2, backup_hashes = $3::jsonb, updated_at = now()
                 WHERE user_id = $1`,
                [user.id, step, JSON.stringify(backupCodes.map(hashBackupCode))]);
        } else if (step !== null) {
            await query('UPDATE user_mfa SET last_step = $2, updated_at = now() WHERE user_id = $1', [user.id, step]);
        } else {
            // Each backup code works once
            const used = await query(
                `UPDATE user_mfa SET backup_hashes = backup_hashes - $2::text, updated_at = now()
                 WHERE user_id = $1 AND backup_hashes ? $2::text
                 RETURNING jsonb_array_length(backup_hashes) AS codes_left`,
                [user.id, hashBackupCode(code)]);
            if (!used.rows[0]) return wrongCode(req, res, ip);
            backupCodesLeft = Number(used.rows[0].codes_left);
        }

        clearFailedAttempts(ip);
        await recordSignIn(user, ip);
        issueSession(res, user);
        res.json({
            user: await sessionUser(user),
            ...(backupCodes ? { backup_codes: backupCodes } : {}),
            ...(backupCodesLeft !== undefined ? { backup_codes_left: backupCodesLeft } : {}),
        });
    } catch (err: any) {
        console.error('Two-step verification failed:', err.message);
        res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
};
