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
            // Match within 80 km, the same radius the donor network uses
            matchesQuery += ` AND calculate_distance(h.latitude, h.longitude, $2, $3) < 80 `;
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
        res.json(await withHospitalDetails(req.user!.id, view.data));
    } catch (err: any) {
        if (err instanceof NetworkError && err.status === 503) {
            return res.status(503).json({ message: err.message });
        }
        console.error('Donor network error:', err);
        res.status(502).json({ message: 'The donor network is unavailable right now.' });
    }
};

/** Only while this many hours old does a shared location mean anything. */
const LOCATION_MAX_AGE_HOURS = 3;

/**
 * Adds what the network does not store to the donor's alerts: where the
 * hospital is (for directions) and, once they have said YES, its phone number
 * and whether they are sharing their live location with it. Also forgets
 * locations for requests the donor is no longer travelling to.
 */
const withHospitalDetails = async (donorUserId: number, view: any) => {
    const alerts: any[] = Array.isArray(view?.alerts) ? view.alerts : [];
    const accepted = alerts.filter((a) => a.status === 'accepted').map((a) => a.match_id);
    await query(
        `DELETE FROM donor_locations WHERE donor_user_id = $1
         AND (NOT (match_id = ANY($2::int[])) OR updated_at < now() - make_interval(hours => $3))`,
        [donorUserId, accepted, LOCATION_MAX_AGE_HOURS]
    );
    if (!alerts.length) return view;

    const [hospitals, sharing] = await Promise.all([
        query(
            `SELECT r.network_request_id, h.latitude, h.longitude, h.address, h.city, h.state, h.contact_number
             FROM blood_requests r JOIN hospitals h ON h.user_id = r.hospital_id
             WHERE r.network_request_id = ANY($1::int[])`,
            [alerts.map((a) => a.request_id)]
        ),
        query('SELECT match_id FROM donor_locations WHERE donor_user_id = $1', [donorUserId]),
    ]);
    const byRequest = new Map(hospitals.rows.map((h: any) => [h.network_request_id, h]));
    const shared = new Set(sharing.rows.map((s: any) => s.match_id));
    return {
        ...view,
        alerts: alerts.map((a) => {
            const h: any = byRequest.get(a.request_id);
            return {
                ...a,
                hospital_location: h && h.latitude != null && h.longitude != null
                    ? { latitude: Number(h.latitude), longitude: Number(h.longitude), address: [h.address, h.city, h.state].filter(Boolean).join(', ') }
                    : null,
                // The hospital's number only once the donor is on their way
                hospital_contact: a.status === 'accepted' ? h?.contact_number ?? null : null,
                sharing_location: shared.has(a.match_id),
            };
        }),
    };
};

// PUT /donor/location  { match_id, latitude, longitude, accuracy_m? }
// Opt-in: the donor shares where they are with the hospital they said YES to.
export const shareLocation = async (req: AuthRequest, res: Response) => {
    const { match_id, latitude, longitude, accuracy_m } = req.body;
    const donorUserId = req.user!.id;
    const accuracy = accuracy_m == null ? null : Math.round(accuracy_m);
    try {
        // Already checked for this donor: just move the pin
        const moved = await query(
            `UPDATE donor_locations SET latitude = $1, longitude = $2, accuracy_m = $3, updated_at = now()
             WHERE match_id = $4 AND donor_user_id = $5 RETURNING match_id`,
            [latitude, longitude, accuracy, match_id, donorUserId]
        );
        if (moved.rows[0]) return res.json({ sharing: true });

        // First report for this request: the network must confirm this donor said YES to it
        const profile = await query('SELECT phone FROM donors WHERE user_id = $1', [donorUserId]);
        const phone = toE164(profile.rows[0]?.phone);
        const view = phone ? await donorPortal(phone) : null;
        const alert = view?.status === 200
            ? (view.data?.alerts ?? []).find((a: any) => a.match_id === match_id && a.status === 'accepted')
            : null;
        if (!alert) {
            return res.status(403).json({ message: 'You can share your location only for a request you have accepted.' });
        }
        await query(
            `INSERT INTO donor_locations (match_id, request_id, donor_user_id, latitude, longitude, accuracy_m)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (match_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                 accuracy_m = EXCLUDED.accuracy_m, donor_user_id = EXCLUDED.donor_user_id, updated_at = now()`,
            [match_id, alert.request_id, donorUserId, latitude, longitude, accuracy]
        );
        res.json({ sharing: true });
    } catch (err: any) {
        if (err instanceof NetworkError) return res.status(502).json({ message: 'The donor network is unavailable right now.' });
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// DELETE /donor/location/:matchId: stop sharing (and forget the last position)
export const stopSharingLocation = async (req: AuthRequest, res: Response) => {
    const matchId = Number(req.params.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ message: 'Invalid match id.' });
    try {
        await query('DELETE FROM donor_locations WHERE match_id = $1 AND donor_user_id = $2', [matchId, req.user!.id]);
        res.json({ sharing: false });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
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
