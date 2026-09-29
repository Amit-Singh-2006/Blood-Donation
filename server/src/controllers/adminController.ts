import { Response } from 'express';
import { query } from '../config/db';
import { networkConfigured } from '../services/donorNetwork';
import { AdminRequest } from '../middleware/requireAdmin';
import { AdminScope, cleanCities, describeScope, donorScopeSql, hospitalScopeSql } from '../utils/jurisdiction';
import { generateInviteCode, hashInviteCode, inviteStatus } from '../utils/adminInvites';

// requireAdmin always sets the scope before these handlers run
const scopeOf = (req: AdminRequest): AdminScope => req.adminScope!;

const serverError = (res: Response, err: unknown) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
};

// GET /admin/donations: donations recorded at hospitals in the admin's jurisdiction
export const getAllDonations = async (req: AdminRequest, res: Response) => {
    try {
        const params: unknown[] = [];
        const result = await query(
            `SELECT dn.* FROM donations dn JOIN hospitals h ON h.user_id = dn.hospital_id
             WHERE ${hospitalScopeSql(scopeOf(req), params)} ORDER BY dn.donation_date DESC LIMIT 1000`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
};

// GET /admin/users: national admins only (see adminRoutes)
export const getAllUsers = async (req: AdminRequest, res: Response) => {
    try {
        const result = await query('SELECT id, name, email, role FROM users');
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
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

// GET /admin/hospitals: unverified hospitals first, for review
export const getHospitals = async (req: AdminRequest, res: Response) => {
    try {
        const params: unknown[] = [];
        const result = await query(
            `SELECT h.user_id AS id, h.hospital_name, h.hospital_type, h.address, h.city, h.state, h.pincode,
                    h.contact_number, h.registration_number, h.latitude, h.longitude,
                    COALESCE(h.is_verified, FALSE) AS is_verified, u.email, u.created_at
             FROM hospitals h JOIN users u ON u.id = h.user_id
             WHERE ${hospitalScopeSql(scopeOf(req), params)}
             ORDER BY COALESCE(h.is_verified, FALSE), u.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /admin/hospitals/:id/verification  { verified: boolean }
// Only verified hospitals can dispatch requests that alert donors. City admins
// can only verify hospitals in their own jurisdiction.
export const setHospitalVerification = async (req: AdminRequest, res: Response) => {
    const hospitalId = Number(req.params.id);
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return res.status(400).json({ message: 'Invalid hospital id.' });
    }
    try {
        const params: unknown[] = [req.body.verified, hospitalId];
        const result = await query(
            `UPDATE hospitals h SET is_verified = $1
             WHERE h.user_id = $2 AND ${hospitalScopeSql(scopeOf(req), params)}
             RETURNING h.user_id AS id, h.hospital_name, h.is_verified`,
            params
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Hospital not found in your jurisdiction.' });
        res.json(result.rows[0]);
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
            WITH scoped_hospitals AS (SELECT h.user_id, h.is_verified FROM hospitals h WHERE ${hospitalCond}),
                 scoped_donors AS (SELECT d.user_id FROM donors d WHERE ${donorCond})
            SELECT
                (SELECT count(*) FROM scoped_donors)::int AS donors,
                (SELECT count(*) FROM scoped_hospitals)::int AS hospitals,
                (SELECT count(*) FROM scoped_hospitals WHERE is_verified)::int AS hospitals_verified,
                (SELECT count(*) FROM blood_requests WHERE ${inScope})::int AS requests,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status IN ('Open', 'Fulfilled'))::int AS requests_active,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status = 'Completed')::int AS requests_completed,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND status = 'Exhausted')::int AS requests_exhausted,
                (SELECT count(*) FROM blood_requests WHERE ${inScope} AND network_request_id IS NULL AND network_error IS NOT NULL)::int AS requests_not_dispatched,
                (SELECT count(*) FROM donations WHERE ${inScope})::int AS donations,
                (SELECT count(*) FROM donations WHERE ${inScope} AND donation_date >= CURRENT_DATE - 30)::int AS donations_30d`,
            params
        );
        res.json({ ...result.rows[0], network_configured: networkConfigured(), jurisdiction: describeScope(scope) });
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
                   (SELECT count(*) FROM donations dn WHERE dn.donor_id = u.id)::int AS donations
            FROM users u JOIN donors d ON d.user_id = u.id
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

// ── Admin management (national admins only, see adminRoutes) ──────────────

// GET /admin/admins
export const listAdmins = async (req: AdminRequest, res: Response) => {
    try {
        const result = await query(`
            SELECT u.id, u.name, u.email, u.created_at, u.last_login_at, p.is_national, p.state, p.cities, p.active,
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
