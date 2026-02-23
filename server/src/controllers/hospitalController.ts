import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { query } from '../config/db';

export const getHospitalDonations = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;

    try {
        const result = await query(
            `SELECT d.id, d.donation_date, d.units, u.name as donor_name 
             FROM donations d 
             JOIN users u ON d.donor_id = u.id 
             WHERE d.hospital_id = $1 
             ORDER BY d.donation_date DESC`,
            [hospitalId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getHospitalInventory = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    try {
        const result = await query('SELECT * FROM blood_inventory WHERE hospital_id = $1', [hospitalId]);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getHospitalRequests = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    try {
        const result = await query('SELECT * FROM blood_requests WHERE hospital_id = $1 ORDER BY created_at DESC', [hospitalId]);
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const createHospitalRequest = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    const { blood_group, units_required, urgency, latitude, longitude } = req.body;

    try {
        const result = await query(
            'INSERT INTO blood_requests (hospital_id, blood_group, units_required, urgency, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [hospitalId, blood_group, units_required, urgency, latitude, longitude]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const updateHospitalInventory = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    const { blood_group, units } = req.body;

    try {
        const result = await query(
            `INSERT INTO blood_inventory (hospital_id, blood_group, units, last_updated) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
             ON CONFLICT (hospital_id, blood_group) 
             DO UPDATE SET units = $3, last_updated = CURRENT_TIMESTAMP
             RETURNING *`,
            [hospitalId, blood_group, units]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const verifyDonation = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    const { donor_id, units, xp_earned } = req.body;

    try {
        await query('BEGIN');

        // 1. Insert into donations
        const donationResult = await query(
            'INSERT INTO donations (donor_id, hospital_id, units, xp_earned) VALUES ($1, $2, $3, $4) RETURNING id, donation_date',
            [donor_id, hospitalId, units, xp_earned || (units * 10)]
        );

        // 2. Update Hospital Inventory
        // First, get the blood group of the donor
        const donorData = await query('SELECT blood_group FROM donors WHERE user_id = $1', [donor_id]);
        if (donorData.rows.length === 0) {
            throw new Error('Donor not found');
        }
        const bloodGroup = donorData.rows[0].blood_group;

        await query(
            `INSERT INTO blood_inventory (hospital_id, blood_group, units, last_updated) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
             ON CONFLICT (hospital_id, blood_group) 
             DO UPDATE SET units = blood_inventory.units + $3, last_updated = CURRENT_TIMESTAMP`,
            [hospitalId, bloodGroup, units]
        );

        // 3. Update Donor Stats (XP and Last Donation Date)
        const earnedXP = xp_earned || (units * 10);
        await query(
            `UPDATE donors 
             SET xp_points = xp_points + $1, 
                 last_donation_date = CURRENT_DATE,
                 current_level = floor((xp_points + $1) / 100) + 1
             WHERE user_id = $2`,
            [earnedXP, donor_id]
        );

        await query('COMMIT');

        res.status(201).json({
            message: 'Donation verified successfully',
            donation: donationResult.rows[0],
            xp_earned: earnedXP
        });
    } catch (err: any) {
        await query('ROLLBACK');
        res.status(500).json({ message: err.message });
    }
};

export const getPotentialDonors = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;

    try {
        // 1. Get the request details
        const requestResult = await query('SELECT * FROM blood_requests WHERE id = $1', [requestId]);
        if (requestResult.rows.length === 0) return res.status(404).json({ message: 'Request not found' });

        const request = requestResult.rows[0];

        // 2. Find matching donors using distance if coordinates exist
        let matchesQuery = `
             SELECT u.name, d.blood_group, d.city, d.phone, d.is_eligible, d.xp_points
             FROM donors d
             JOIN users u ON d.user_id = u.id
             WHERE d.blood_group = $1
             AND d.is_eligible = TRUE
        `;
        let queryParams = [request.blood_group];

        if (request.latitude != null && request.longitude != null) {
            matchesQuery += ` AND d.latitude IS NOT NULL AND calculate_distance(d.latitude, d.longitude, $2, $3) < 50 `;
            queryParams.push(request.latitude, request.longitude);
        } else {
            // Fallback to hospital city
            matchesQuery += ` AND d.city = (SELECT city FROM hospitals WHERE user_id = $2) `;
            queryParams.push(request.hospital_id);
        }

        matchesQuery += ` ORDER BY d.xp_points DESC NULLS LAST`;

        const donors = await query(matchesQuery, queryParams);

        res.json(donors.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
