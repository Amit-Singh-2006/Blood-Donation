import { Request, Response } from 'express';
import { query } from '../config/db';

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
