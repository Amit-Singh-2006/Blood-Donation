import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { query } from '../config/db';

export const getDonorDonations = async (req: AuthRequest, res: Response) => {
    const donorId = req.user?.id;

    try {
        const result = await query(
            `SELECT d.id, d.donation_date, d.units, h.hospital_name as hospital_name 
             FROM donations d 
             JOIN hospitals h ON d.hospital_id = h.user_id 
             WHERE d.donor_id = $1 
             ORDER BY d.donation_date DESC`,
            [donorId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getMatchedRequests = async (req: AuthRequest, res: Response) => {
    const donorId = req.user?.id;

    try {
        // 1. Get donor profile (blood group and city/location)
        const donorResult = await query('SELECT blood_group, city, latitude, longitude FROM donors WHERE user_id = $1', [donorId]);
        if (donorResult.rows.length === 0) return res.status(404).json({ message: 'Donor profile not found' });

        const donor = donorResult.rows[0];

        // 2. Simple Matching: Same blood type + Same city (Can be expanded with radius logic later)
        const matches = await query(
            `SELECT br.*, h.hospital_name, h.city as hospital_city
             FROM blood_requests br
             JOIN hospitals h ON br.hospital_id = h.user_id
             WHERE br.blood_group = $1 
             AND br.status = 'Open'
             AND (h.city = $2 OR br.latitude IS NOT NULL)
             ORDER BY br.urgency DESC, br.created_at DESC`,
            [donor.blood_group, donor.city]
        );

        res.json(matches.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
    try {
        const result = await query(
            `SELECT u.name, d.xp_points, d.current_level, d.blood_group, d.city
             FROM donors d
             JOIN users u ON d.user_id = u.id
             ORDER BY d.xp_points DESC
             LIMIT 10`
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getImpactPrediction = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;

    try {
        const result = await query(
            `SELECT br.*, h.hospital_name, bi.units as current_stock
             FROM blood_requests br
             JOIN hospitals h ON br.hospital_id = h.user_id
             LEFT JOIN blood_inventory bi ON br.hospital_id = bi.hospital_id AND br.blood_group = bi.blood_group
             WHERE br.id = $1`,
            [requestId]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Request not found' });

        const data = result.rows[0];
        const stock = data.current_stock || 0;

        let impactLevel = 'Normal';
        let insight = 'Your donation will help maintain a healthy blood supply.';

        if (data.urgency === 'Urgent' || stock < 10) {
            impactLevel = 'High';
            insight = `Critical Need! the current inventory for ${data.blood_group} is low (${stock} units). Your donation could save a life today.`;
        } else if (data.urgency === 'Emergency' || stock < 5) {
            impactLevel = 'Critical';
            insight = `Immediate Action Required! This hospital is in an emergency state for ${data.blood_group}. Your contribution is vital for upcoming surgeries.`;
        }

        res.json({
            requestId: data.id,
            blood_group: data.blood_group,
            impactLevel,
            insight,
            current_stock: stock,
            urgency: data.urgency
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
