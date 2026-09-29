import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { query } from '../config/db';
import { recipientGroupsFor } from '../utils/bloodCompatibility';
import { NetworkError, PreferenceChange, donorPortal, registerDonor, toE164 } from '../services/donorNetwork';

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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const getMatchedRequests = async (req: AuthRequest, res: Response) => {
    const donorId = req.user?.id;

    try {
        // 1. Get donor profile (blood group and city/location)
        const donorResult = await query('SELECT blood_group, city, latitude, longitude FROM donors WHERE user_id = $1', [donorId]);
        if (donorResult.rows.length === 0) return res.status(404).json({ message: 'Donor profile not found' });

        const donor = donorResult.rows[0];

        // 2. Advanced Matching: Use calculate_distance if coordinates are available, else fallback to city
        let matchesQuery = `
            SELECT br.*, h.hospital_name, h.city as hospital_city
            FROM blood_requests br
            JOIN hospitals h ON br.hospital_id = h.user_id
            WHERE br.blood_group = ANY($1)
            AND br.status = 'Open'
        `;
        // Every open request whose patient can receive this donor's blood (ABO/Rh)
        let queryParams: any[] = [recipientGroupsFor(donor.blood_group)];

        if (donor.latitude != null && donor.longitude != null) {
            // Match within ~50 miles radius
            matchesQuery += ` AND calculate_distance(h.latitude, h.longitude, $2, $3) < 50 `;
            queryParams.push(donor.latitude, donor.longitude);
        } else {
            // Fallback to city
            matchesQuery += ` AND h.city = $2 `;
            queryParams.push(donor.city);
        }

        // Sort by severity, not alphabetically (alphabetical DESC puts 'Emergency' last)
        matchesQuery += ` ORDER BY CASE br.urgency WHEN 'Emergency' THEN 3 WHEN 'Urgent' THEN 2 ELSE 1 END DESC, br.created_at DESC`;

        const matches = await query(matchesQuery, queryParams);

        res.json(matches.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
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

        // Check the most severe condition first, otherwise 'Critical' is unreachable
        if (data.urgency === 'Emergency' || stock < 5) {
            impactLevel = 'Critical';
            insight = `Immediate Action Required! This hospital is in an emergency state for ${data.blood_group}. Your contribution is vital for upcoming surgeries.`;
        } else if (data.urgency === 'Urgent' || stock < 10) {
            impactLevel = 'High';
            insight = `Critical Need! the current inventory for ${data.blood_group} is low (${stock} units). Your donation could save a life today.`;
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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Answers with the donor's view from the n8n donor network (live alerts with
 * their one-tap links, eligibility, history), applying `change` first when
 * given. Donors who signed up before the network existed are enrolled here.
 */
const respondWithNetworkView = async (req: AuthRequest, res: Response, change?: PreferenceChange) => {
    try {
        const result = await query(
            `SELECT u.name, d.phone, d.blood_group, d.city, d.gender
             FROM donors d JOIN users u ON u.id = d.user_id
             WHERE d.user_id = $1`,
            [req.user?.id]
        );
        const profile = result.rows[0];
        if (!profile) return res.status(404).json({ message: 'Donor profile not found.' });

        const phone = toE164(profile.phone);
        if (!phone) {
            return res.status(400).json({ message: 'Add a valid mobile number to your profile to receive blood requests.' });
        }

        let view = await donorPortal(phone, change);
        if (view.status === 404) {
            await registerDonor({ ...profile, phone }, change);
            view = await donorPortal(phone);
        }
        if (view.status !== 200) throw new NetworkError(`Donor portal answered ${view.status}`, view.status);
        res.json(view.data);
    } catch (err: any) {
        if (err instanceof NetworkError && err.status === 503) {
            return res.status(503).json({ message: err.message });
        }
        console.error('Donor network error:', err);
        res.status(502).json({ message: 'The donor network is unavailable right now.' });
    }
};

// GET /donor/network
export const getNetworkStatus = (req: AuthRequest, res: Response) => respondWithNetworkView(req, res);

// PUT /donor/network  { available?, preferred_channel? }
export const updateNetworkPreferences = (req: AuthRequest, res: Response) =>
    respondWithNetworkView(req, res, req.body as PreferenceChange);

// GET /donor/centers: verified LifeLink hospitals, the donor's city first
export const getDonationCenters = async (req: AuthRequest, res: Response) => {
    try {
        const result = await query(
            `SELECT h.hospital_name, h.city, h.contact_number,
                    (lower(h.city) = lower(d.city)) AS in_your_city
             FROM hospitals h
             LEFT JOIN donors d ON d.user_id = $1
             WHERE h.is_verified = TRUE
             ORDER BY (lower(h.city) = lower(d.city)) DESC NULLS LAST, h.city, h.hospital_name
             LIMIT 50`,
            [req.user?.id]
        );
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
