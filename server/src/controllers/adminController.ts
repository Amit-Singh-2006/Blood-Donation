import { Response } from 'express';
import { endAllKeptSessions } from '../utils/keepSignedIn';
import { query } from '../config/db';
import { networkConfigured } from '../services/donorNetwork';
import { messagingStatus, outboxSummary } from '../services/messaging';
import { respond, timerStatus } from '../network/engine';
import { AdminRequest } from '../middleware/requireAdmin';
import { forgetAccountCheck } from '../middleware/authMiddleware';
import { AdminScope, cleanCities, describeScope, donorScopeSql, hospitalScopeSql } from '../utils/jurisdiction';
import { generateInviteCode, hashInviteCode, inviteStatus } from '../utils/adminInvites';
import { reviewColumns, toReview } from './verificationController';

// requireAdmin always sets the scope before these handlers run
const scopeOf = (req: AdminRequest): AdminScope => req.adminScope!;

const serverError = (res: Response, err: unknown) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
};

// GET /admin/me: who is signed in and what they can see
export const getMe = async (req: AdminRequest, res: Response) => {
    try {
        const result = await query(
            `SELECT u.id, u.name, u.email, p.is_national, p.state, p.cities
             FROM users u JOIN admin_profiles p ON p.user_id = u.id WHERE u.id = $1`,
            [scopeOf(req).userId]
        );
        const me = result.rows[0];
        if (!me) return res.status(404).json({ message: 'Admin not found.' });
        res.json({ ...me, jurisdiction: describeScope(me) });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/hospitals: hospitals waiting for review first, with their documents
// (names and sizes only; each file is opened through /admin/hospitals/:id/documents/:kind)
export const getHospitals = async (req: AdminRequest, res: Response) => {
    try {
        const params: unknown[] = [];
        const result = await query(
            `SELECT h.user_id AS id, h.hospital_name, h.hospital_type, h.address, h.city, h.state, h.pincode,
                    h.contact_number, h.registration_number, h.latitude, h.longitude,
                    COALESCE(h.is_verified, FALSE) AS is_verified, u.email, u.created_at,
                    EXISTS (SELECT 1 FROM user_mfa m WHERE m.user_id = h.user_id AND m.enabled) AS mfa_enabled,
                    u.disabled_at, u.disabled_reason,
                    ${reviewColumns}
             FROM hospitals h JOIN users u ON u.id = h.user_id
             WHERE ${hospitalScopeSql(scopeOf(req), params)}
             ORDER BY CASE h.verification_status WHEN 'pending' THEN 0 WHEN 'changes_requested' THEN 1 WHEN 'not_submitted' THEN 2 ELSE 3 END,
                      h.verification_submitted_at NULLS LAST, u.created_at DESC`,
            params
        );
        res.json(result.rows.map(toReview));
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/overview: headline counts for the admin's jurisdiction
export const getOverview = async (req: AdminRequest, res: Response) => {
    try {
        const scope = scopeOf(req);
        const params: unknown[] = [];
        const hospitalCond = hospitalScopeSql(scope, params);
        const donorCond = donorScopeSql(scope, params);
        const inScope = 'hospital_id IN (SELECT user_id FROM scoped_hospitals)';
        const result = await query(`
            WITH scoped_hospitals AS (SELECT h.user_id, h.is_verified, h.verification_status FROM hospitals h WHERE ${hospitalCond}),
                 scoped_donors AS (SELECT d.user_id FROM donors d WHERE ${donorCond})
            SELECT
                (SELECT count(*) FROM scoped_donors)::int AS donors,
                (SELECT count(*) FROM scoped_hospitals)::int AS hospitals,
                (SELECT count(*) FROM scoped_hospitals WHERE is_verified)::int AS hospitals_verified,
                (SELECT count(*) FROM scoped_hospitals WHERE verification_status = 'pending')::int AS hospitals_pending_review,
                (SELECT count(*) FROM blood_requests WHERE ${inScope})::int AS requests,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status IN ('Open', 'Fulfilled'))::int AS requests_active,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status = 'Completed')::int AS requests_completed,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status = 'Exhausted')::int AS requests_exhausted,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND network_request_id IS NULL AND network_error IS NOT NULL)::int AS requests_not_dispatched,
                (SELECT count(*) FROM donations WHERE ${inScope})::int AS donations,
                (SELECT count(*) FROM donations WHERE ${inScope} AND donation_date >= CURRENT_DATE - 30)::int AS donations_30d`,
            params
        );
        const [messages, timer] = await Promise.all([outboxSummary().catch(() => null), timerStatus()]);
        res.json({
            ...result.rows[0],
            network_configured: networkConfigured(),
            // Which message channels have their settings, the escalation timer, and messages in the last day
            messaging: messagingStatus(),
            network_timer: timer,
            messages,
            jurisdiction: describeScope(scope),
        });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/requests?limit=N: blood requests from hospitals in the admin's
// jurisdiction, newest first (the hospital's control token never leaves the server)
export const getRequests = async (req: AdminRequest, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    try {
        const params: unknown[] = [];
        const cond = hospitalScopeSql(scopeOf(req), params);
        params.push(limit);
        const result = await query(`
            SELECT r.id, r.blood_group, r.units_required, r.urgency, r.status, r.patient_ref, r.required_by,
                   r.created_at, r.tracking_token, r.network_error, (r.network_request_id IS NOT NULL) AS dispatched,
                   h.user_id AS hospital_id, h.hospital_name, h.city, h.state
            FROM blood_requests r JOIN hospitals h ON h.user_id = r.hospital_id
            WHERE ${cond}
            ORDER BY r.created_at DESC
            LIMIT $${params.length}`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/donors: newest first, with their recorded donations
export const getDonors = async (req: AdminRequest, res: Response) => {
    try {
        const params: unknown[] = [];
        const result = await query(`
            SELECT u.id, u.name, u.email, u.created_at, d.blood_group, d.city, d.phone, d.gender,
                   d.last_donation_date, COALESCE(d.xp_points, 0) AS xp_points,
                   (SELECT count(*) FROM donations dn WHERE dn.donor_id = u.id)::int AS donations,
                   -- Confirmed by a hospital lab after a donation, or still self-reported
                   nd.blood_group_verified_at, u.disabled_at, u.disabled_reason
            FROM users u JOIN donors d ON d.user_id = u.id
            LEFT JOIN network_donors nd ON nd.user_id = u.id
            WHERE ${donorScopeSql(scopeOf(req), params)}
            ORDER BY u.created_at DESC
            LIMIT 500`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
};

/**
 * PUT /admin/users/:id/active  { active, reason? }
 * Deactivates (or reactivates) a donor or hospital account in the admin's
 * jurisdiction, e.g. for abuse. A deactivated account cannot sign in, its
 * kept sign-ins end now, and a donor is no longer alerted. Admin accounts are
 * managed separately (PUT /admin/admins/:id/active).
 */
export const setUserActive = async (req: AdminRequest, res: Response) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: 'Invalid account id.' });
    const { active, reason } = req.body;
    const scope = scopeOf(req);
    try {
        const target = (await query('SELECT id, role FROM users WHERE id = $1', [userId])).rows[0];
        const params: unknown[] = [userId];
        const inScope = target?.role === 'donor'
            ? (await query(`SELECT 1 FROM donors d WHERE d.user_id = $1 AND ${donorScopeSql(scope, params)}`, params)).rows.length > 0
            : target?.role === 'hospital'
                ? (await query(`SELECT 1 FROM hospitals h WHERE h.user_id = $1 AND ${hospitalScopeSql(scope, params)}`, params)).rows.length > 0
                : false;
        if (!inScope) return res.status(404).json({ message: 'No donor or hospital account with this id in your jurisdiction.' });

        if (active) {
            await query('UPDATE users SET disabled_at = NULL, disabled_reason = NULL, disabled_by = NULL WHERE id = $1', [userId]);
        } else {
            await query('UPDATE users SET disabled_at = now(), disabled_reason = $2, disabled_by = $3 WHERE id = $1', [userId, reason, scope.userId]);
            await endAllKeptSessions(userId);
            if (target.role === 'donor') await query('UPDATE network_donors SET available = FALSE WHERE user_id = $1', [userId]);
            if (target.role === 'hospital') {
                // Its open requests stop too, standing down every donor alerted for them
                const open = (await query(
                    `SELECT nr.id, nr.hospital_token FROM blood_requests br JOIN network_requests nr ON nr.id = br.network_request_id
                     WHERE br.hospital_id = $1 AND nr.status IN ('Open', 'Fulfilled')`,
                    [userId]
                )).rows;
                for (const r of open) {
                    await respond({ r: String(r.id), h: r.hospital_token, a: 'cancel', format: 'json' })
                        .catch((err) => console.error(`Could not cancel network request ${r.id}:`, err?.message ?? err));
                }
            }
        }
        forgetAccountCheck(userId);
        console.info(`Admin ${scope.userId} ${active ? 'reactivated' : 'deactivated'} ${target.role} account ${userId}`);
        res.json({ id: userId, role: target.role, active, disabled_reason: active ? null : reason });
    } catch (err) {
        serverError(res, err);
    }
};

// ── Admin management (national admins only, see adminRoutes) ──────────────

// GET /admin/admins
export const listAdmins = async (req: AdminRequest, res: Response) => {
    try {
        const result = await query(`
            SELECT u.id, u.name, u.email, u.created_at, u.last_login_at, p.is_national, p.state, p.cities, p.active,
                   EXISTS (SELECT 1 FROM user_mfa m WHERE m.user_id = u.id AND m.enabled) AS mfa_enabled,
                   inviter.name AS invited_by
            FROM users u
            JOIN admin_profiles p ON p.user_id = u.id
            LEFT JOIN users inviter ON inviter.id = p.invited_by
            WHERE u.role = 'admin'
            ORDER BY p.is_national DESC, u.created_at`);
        res.json(result.rows.map((a) => ({ ...a, jurisdiction: describeScope(a) })));
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /admin/admins/:id/active  { active: boolean }
export const setAdminActive = async (req: AdminRequest, res: Response) => {
    const adminId = Number(req.params.id);
    if (!Number.isInteger(adminId) || adminId <= 0) {
        return res.status(400).json({ message: 'Invalid admin id.' });
    }
    if (adminId === scopeOf(req).userId) {
        return res.status(400).json({ message: 'You cannot remove your own admin access.' });
    }
    try {
        const result = await query(
            `UPDATE admin_profiles SET active = $1 WHERE user_id = $2
             RETURNING user_id AS id, active`,
            [req.body.active, adminId]
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Admin not found.' });
        // Removing access also signs them out of "keep me signed in" on every device
        if (!req.body.active) await endAllKeptSessions(adminId);
        res.json(result.rows[0]);
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/invites
export const listInvites = async (req: AdminRequest, res: Response) => {
    try {
        const result = await query(`
            SELECT i.id, i.name, i.email, i.is_national, i.state, i.cities, i.code_hint,
                   i.created_at, i.expires_at, i.used_at, i.revoked_at,
                   creator.name AS created_by, used.name AS used_by
            FROM admin_invites i
            LEFT JOIN users creator ON creator.id = i.created_by
            LEFT JOIN users used ON used.id = i.used_by
            ORDER BY i.created_at DESC
            LIMIT 200`);
        res.json(result.rows.map((i) => ({ ...i, status: inviteStatus(i), jurisdiction: describeScope(i) })));
    } catch (err) {
        serverError(res, err);
    }
};

// POST /admin/invites: returns the code once; only its hash is stored
export const createInvite = async (req: AdminRequest, res: Response) => {
    const { name, email, is_national, state, cities, valid_days } = req.body;
    try {
        const existing = await query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
        if (existing.rows.length) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        // One live invite per person: issuing a new one cancels the old
        await query(
            `UPDATE admin_invites SET revoked_at = now()
             WHERE lower(email) = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
            [email]
        );

        const code = generateInviteCode();
        const result = await query(
            `INSERT INTO admin_invites (code_hash, code_hint, name, email, is_national, state, cities, created_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(days => $9))
             RETURNING id, name, email, is_national, state, cities, code_hint, created_at, expires_at`,
            [hashInviteCode(code), code.slice(-4), name, email, is_national, is_national ? null : state,
                is_national ? [] : cleanCities(cities), scopeOf(req).userId, valid_days]
        );
        const invite = result.rows[0];
        res.status(201).json({ invite: { ...invite, status: 'pending', jurisdiction: describeScope(invite) }, code });
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /admin/invites/:id/revoke
export const revokeInvite = async (req: AdminRequest, res: Response) => {
    const inviteId = Number(req.params.id);
    if (!Number.isInteger(inviteId) || inviteId <= 0) {
        return res.status(400).json({ message: 'Invalid invite id.' });
    }
    try {
        const result = await query(
            `UPDATE admin_invites SET revoked_at = now()
             WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
             RETURNING id`,
            [inviteId]
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'No open invite with that id.' });
        res.json({ id: inviteId, status: 'revoked' });
    } catch (err) {
        serverError(res, err);
    }
};

// POST /admin/users/:id/mfa-reset
// For a lost phone: the account sets up its authenticator app again at its next
// sign-in. National admins can reset admins and hospitals; city admins, the
// hospitals in their jurisdiction.
export const resetSecondStep = async (req: AdminRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid account' });
    try {
        const target = (await query('SELECT id, role FROM users WHERE id = $1', [id])).rows[0];
        if (!target || !['admin', 'hospital'].includes(target.role)) return res.status(404).json({ message: 'Account not found' });
        const scope = scopeOf(req);
        if (target.role === 'admin' && !scope.isNational) {
            return res.status(403).json({ message: 'Only the national admin can reset another admin.' });
        }
        if (target.role === 'hospital' && !scope.isNational) {
            const params: unknown[] = [id];
            const inScope = await query(`SELECT 1 FROM hospitals h WHERE h.user_id = $1 AND ${hospitalScopeSql(scope, params)}`, params);
            if (!inScope.rows[0]) return res.status(403).json({ message: 'This hospital is outside your jurisdiction.' });
        }
        await query('DELETE FROM user_mfa WHERE user_id = $1', [id]);
        // A lost phone may still be signed in: end the account's sign-ins everywhere
        await endAllKeptSessions(id);
        res.json({ ok: true });
    } catch (err) {
        serverError(res, err);
    }
};
