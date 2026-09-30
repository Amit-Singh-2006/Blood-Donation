import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool, { query } from '../config/db';
import { compatibleDonorGroups, ELIGIBILITY_WINDOW_SQL } from '../utils/bloodCompatibility';
import {
    DispatchResult, HospitalDonorView, HospitalRequestView, NetworkError,
    dispatchRequest, hospitalPortal, networkConfigured, toE164,
} from '../services/donorNetwork';

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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const getHospitalInventory = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    try {
        const result = await query('SELECT * FROM blood_inventory WHERE hospital_id = $1', [hospitalId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

const loadHospital = async (userId: number | undefined) => {
    const result = await query(
        `SELECT hospital_name, hospital_type, registration_number, address, city, state, pincode,
                contact_number, latitude, longitude, is_verified
         FROM hospitals WHERE user_id = $1`,
        [userId]
    );
    return result.rows[0];
};

/** The hospital token authorises actions on the network; it never leaves the server. */
const publicRequest = ({ hospital_token, ...rest }: Record<string, any>) => rest;

const toNumber = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v));

// GET /hospital/profile
export const getHospitalProfile = async (req: AuthRequest, res: Response) => {
    try {
        const hospital = await loadHospital(req.user?.id);
        if (!hospital) return res.status(404).json({ message: 'Hospital profile not found.' });
        res.json({
            hospital_name: hospital.hospital_name,
            hospital_type: hospital.hospital_type,
            registration_number: hospital.registration_number,
            address: hospital.address,
            city: hospital.city,
            state: hospital.state,
            pincode: hospital.pincode,
            contact_number: hospital.contact_number,
            has_location: hospital.latitude != null && hospital.longitude != null,
            is_verified: !!hospital.is_verified,
            network_configured: networkConfigured(),
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * Records donations the hospital confirmed on the network in `donations`, so
 * they appear in the donor's and hospital's history. Donors are matched by
 * phone; donors who joined only through the network (e.g. USSD) are skipped.
 */
const recordNetworkDonations = async (hospitalId: number | undefined, donors: HospitalDonorView[] = []) => {
    for (const d of donors) {
        if (d.status !== 'donated' || !d.phone) continue;
        // A new donation also moves the donor's rest period and XP, like the network does
        await query(
            `WITH donor AS (
                 SELECT user_id FROM donors
                 WHERE right(regexp_replace(phone, '\\D', '', 'g'), 10) = right(regexp_replace($1, '\\D', '', 'g'), 10)
                 LIMIT 1
             ), inserted AS (
                 INSERT INTO donations (donor_id, hospital_id, units, donation_date, xp_earned, network_match_id)
                 SELECT user_id, $2, 1, COALESCE($3::date, CURRENT_DATE), 10, $4 FROM donor
                 ON CONFLICT (network_match_id) DO NOTHING
                 RETURNING donor_id, donation_date
             )
             UPDATE donors SET
                 last_donation_date = GREATEST(COALESCE(donors.last_donation_date, inserted.donation_date), inserted.donation_date),
                 xp_points = COALESCE(donors.xp_points, 0) + 10
             FROM inserted WHERE donors.user_id = inserted.donor_id`,
            [d.phone, hospitalId, d.responded_at, d.match_id]
        );
    }
};

// GET /hospital/requests: the hospital's requests with live progress from the network
export const getHospitalRequests = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    try {
        const { rows } = await query('SELECT * FROM blood_requests WHERE hospital_id = $1 ORDER BY created_at DESC LIMIT 50', [hospitalId]);

        // One network call covers the 25 most recent linked requests
        const linked = rows.filter((r: any) => r.network_request_id && r.hospital_token).slice(0, 25);
        const views = new Map<number, HospitalRequestView>();
        let networkError: string | undefined;
        if (linked.length && networkConfigured()) {
            try {
                const live = await hospitalPortal(linked.map((r: any) => ({ request_id: r.network_request_id, hospital_token: r.hospital_token })));
                for (const v of live) if (v.found) views.set(v.request_id, v);
            } catch (err) {
                console.error('Hospital portal error:', err);
                networkError = 'Live donor updates are unavailable right now.';
            }
        }

        const requests = [];
        for (const r of rows) {
            const live = views.get(r.network_request_id) ?? null;
            if (live) {
                // Keep our copy in step with the network, for admin views and history
                if (live.status && live.status !== r.status) {
                    await query('UPDATE blood_requests SET status = $1 WHERE id = $2', [live.status, r.id]);
                }
                await recordNetworkDonations(hospitalId, live.donors);
            }
            requests.push({ ...publicRequest(r), status: live?.status ?? r.status, live });
        }
        res.json({ requests, network_error: networkError ?? null });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// POST /hospital/requests: saves the request and dispatches it to the donor network
export const createHospitalRequest = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    const { blood_group, units_required, urgency, latitude, longitude, patient_ref, required_by } = req.body;

    try {
        const hospital = await loadHospital(hospitalId);
        if (!hospital) return res.status(404).json({ message: 'Hospital profile not found.' });
        if (!hospital.is_verified) {
            return res.status(403).json({ message: 'Your hospital must be verified by a LifeLink admin before requests can alert donors.' });
        }

        const lat = toNumber(latitude) ?? toNumber(hospital.latitude);
        const lng = toNumber(longitude) ?? toNumber(hospital.longitude);
        const inserted = await query(
            `INSERT INTO blood_requests (hospital_id, blood_group, units_required, urgency, latitude, longitude, patient_ref, required_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [hospitalId, blood_group, units_required, urgency, lat ?? null, lng ?? null, patient_ref || null, required_by || null]
        );
        let request = inserted.rows[0];

        let network: DispatchResult | null = null;
        let warning: string | undefined;
        try {
            network = await dispatchRequest({
                hospital_name: hospital.hospital_name,
                hospital_city: hospital.city,
                hospital_contact: toE164(hospital.contact_number) ?? undefined,
                patient_ref: patient_ref || undefined,
                blood_group,
                units_required,
                urgency,
                ...(lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : {}),
                required_by: required_by || undefined,
            });
            const updated = await query(
                `UPDATE blood_requests SET network_request_id = $1, tracking_token = $2, hospital_token = $3, status = $4, network_error = NULL
                 WHERE id = $5 RETURNING *`,
                [network.request_id, network.tracking_token, network.hospital_token,
                    network.status === 'no_compatible_donors' ? 'Exhausted' : 'Open', request.id]
            );
            request = updated.rows[0];
        } catch (err) {
            console.error('Dispatch failed:', err);
            warning = err instanceof NetworkError && err.status === 400
                ? `The donor network rejected the request: ${err.message}`
                : 'The request was saved, but the donor network could not be reached, so no donors were alerted yet. Please try again shortly.';
            await query('UPDATE blood_requests SET network_error = $1 WHERE id = $2', [warning, request.id]);
        }

        res.status(201).json({
            request: publicRequest(request),
            network: network && { ...network, hospital_token: undefined },
            warning: warning ?? null,
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const verifyDonation = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user?.id;
    const { donor_id, units, xp_earned } = req.body;

    // A transaction must run on a single connection: pool.query() may hand each
    // statement to a different client, so BEGIN/COMMIT/ROLLBACK would not apply.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert into donations
        const donationResult = await client.query(
            'INSERT INTO donations (donor_id, hospital_id, units, xp_earned) VALUES ($1, $2, $3, $4) RETURNING id, donation_date',
            [donor_id, hospitalId, units, xp_earned || (units * 10)]
        );

        // 2. Update Hospital Inventory
        // First, get the blood group of the donor
        const donorData = await client.query('SELECT blood_group FROM donors WHERE user_id = $1', [donor_id]);
        if (donorData.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Donor not found' });
        }
        const bloodGroup = donorData.rows[0].blood_group;

        await client.query(
            `INSERT INTO blood_inventory (hospital_id, blood_group, units, last_updated) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
             ON CONFLICT (hospital_id, blood_group) 
             DO UPDATE SET units = blood_inventory.units + $3, last_updated = CURRENT_TIMESTAMP`,
            [hospitalId, bloodGroup, units]
        );

        // 3. Update Donor Stats (XP and Last Donation Date)
        const earnedXP = xp_earned || (units * 10);
        await client.query(
            `UPDATE donors 
             SET xp_points = xp_points + $1, 
                 last_donation_date = CURRENT_DATE,
                 current_level = floor((xp_points + $1) / 100) + 1
             WHERE user_id = $2`,
            [earnedXP, donor_id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Donation verified successfully',
            donation: donationResult.rows[0],
            xp_earned: earnedXP
        });
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('verifyDonation error:', err);
        res.status(500).json({ message: 'Failed to verify donation.' });
    } finally {
        client.release();
    }
};

export const getPotentialDonors = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const hospitalId = req.user?.id;

    try {
        // 1. Get the request details
        const requestResult = await query('SELECT * FROM blood_requests WHERE id = $1', [requestId]);
        if (requestResult.rows.length === 0) return res.status(404).json({ message: 'Request not found' });

        const request = requestResult.rows[0];

        // Ensure the hospital owns the request (IDOR Prevention)
        if (request.hospital_id !== hospitalId) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this request' });
        }

        // 2. Compatibility engine: ABO/Rh-compatible donors who are eligible and past
        //    their deferral window, within 80 km (or in the hospital's city)
        const queryParams: any[] = [compatibleDonorGroups(request.blood_group), request.blood_group];
        let distanceSql = 'NULL';
        let locationFilter: string;

        if (request.latitude != null && request.longitude != null) {
            distanceSql = 'calculate_distance(d.latitude, d.longitude, $3, $4)';
            locationFilter = `d.latitude IS NOT NULL AND ${distanceSql} < 80`;
            queryParams.push(request.latitude, request.longitude);
        } else {
            // Fallback to hospital city
            locationFilter = 'd.city = (SELECT city FROM hospitals WHERE user_id = $3)';
            queryParams.push(request.hospital_id);
        }

        // Ranked by proximity, then ABO-identical donors first (keeps universal O- for
        // the patients who can only take O-), then XP
        const matchesQuery = `
             SELECT u.name, d.blood_group, d.city, d.phone, d.is_eligible, d.xp_points,
                    ${distanceSql} AS distance_km
             FROM donors d
             JOIN users u ON d.user_id = u.id
             WHERE d.blood_group = ANY($1)
             AND d.is_eligible = TRUE
             AND ${ELIGIBILITY_WINDOW_SQL}
             AND ${locationFilter}
             ORDER BY distance_km ASC NULLS LAST, (d.blood_group = $2) DESC, d.xp_points DESC NULLS LAST`;

        const donors = await query(matchesQuery, queryParams);

        res.json(donors.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
