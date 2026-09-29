import { Request, Response } from 'express';
import { query } from '../config/db';
import { networkConfigured } from '../services/donorNetwork';

export const getAllDonations = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM donations');
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT id, name, email, role FROM users');
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// GET /admin/hospitals: unverified hospitals first, for review
export const getHospitals = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT h.user_id AS id, h.hospital_name, h.city, h.contact_number, h.registration_number,
                    COALESCE(h.is_verified, FALSE) AS is_verified, u.email, u.created_at
             FROM hospitals h JOIN users u ON u.id = h.user_id
             ORDER BY COALESCE(h.is_verified, FALSE), u.created_at DESC`
        );
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// PUT /admin/hospitals/:id/verification  { verified: boolean }
// Only verified hospitals can dispatch requests that alert donors.
export const setHospitalVerification = async (req: Request, res: Response) => {
    const hospitalId = Number(req.params.id);
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return res.status(400).json({ message: 'Invalid hospital id.' });
    }
    try {
        const result = await query(
            'UPDATE hospitals SET is_verified = $1 WHERE user_id = $2 RETURNING user_id AS id, hospital_name, is_verified',
            [req.body.verified, hospitalId]
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Hospital not found.' });
        res.json(result.rows[0]);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// GET /admin/overview: headline counts from the website database
export const getOverview = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT
                (SELECT count(*) FROM users WHERE role = 'donor')::int AS donors,
                (SELECT count(*) FROM hospitals)::int AS hospitals,
                (SELECT count(*) FROM hospitals WHERE is_verified)::int AS hospitals_verified,
                (SELECT count(*) FROM blood_requests)::int AS requests,
                (SELECT count(*) FROM blood_requests WHERE status IN ('Open', 'Fulfilled'))::int AS requests_active,
                (SELECT count(*) FROM blood_requests WHERE status = 'Completed')::int AS requests_completed,
                (SELECT count(*) FROM blood_requests WHERE status = 'Exhausted')::int AS requests_exhausted,
                (SELECT count(*) FROM blood_requests WHERE network_request_id IS NULL AND network_error IS NOT NULL)::int AS requests_not_dispatched,
                (SELECT count(*) FROM donations)::int AS donations,
                (SELECT count(*) FROM donations WHERE donation_date >= CURRENT_DATE - 30)::int AS donations_30d`);
        res.json({ ...result.rows[0], network_configured: networkConfigured() });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// GET /admin/donors: newest first, with their recorded donations
export const getDonors = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT u.id, u.name, u.email, u.created_at, d.blood_group, d.city, d.phone, d.gender,
                   d.last_donation_date, COALESCE(d.xp_points, 0) AS xp_points,
                   (SELECT count(*) FROM donations dn WHERE dn.donor_id = u.id)::int AS donations
            FROM users u JOIN donors d ON d.user_id = u.id
            ORDER BY u.created_at DESC
            LIMIT 500`);
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
