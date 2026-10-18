import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool, { query } from '../config/db';
import { NetworkError, PreferenceChange, donorPortal, registerDonor, toE164 } from '../services/donorNetwork';
import { PHONE_TAKEN } from '../network/engine';

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

/**
 * Answers with the donor's view from the donor network (live alerts with
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

        const userId = req.user!.id;
        let view = await donorPortal(phone, change, userId);
        if (view.status === 404) {
            await registerDonor({ ...profile, phone }, change, userId);
            view = await donorPortal(phone, undefined, userId);
        }
        // The phone is another account's: never show or change that donor's alerts
        if (view.status === 409) return res.status(409).json({ message: view.data?.message });
        if (view.status !== 200) throw new NetworkError(`Donor portal answered ${view.status}`, view.status);
        res.json(await withHospitalDetails(userId, view.data));
    } catch (err: any) {
        if (err instanceof NetworkError && (err.status === 503 || err.status === 409)) {
            return res.status(err.status).json({ message: err.message });
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
        const view = phone ? await donorPortal(phone, undefined, donorUserId) : null;
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

const PROFILE_SQL = `SELECT u.name, u.email, d.phone, d.city, d.gender, to_char(d.dob, 'YYYY-MM-DD') AS dob, d.blood_group,
        nd.id AS entry_id, nd.blood_group_verified_at IS NOT NULL AS blood_group_verified
    FROM users u JOIN donors d ON d.user_id = u.id
    LEFT JOIN network_donors nd ON nd.user_id = u.id
    WHERE u.id = $1`;

const publicProfile = ({ entry_id, ...profile }: Record<string, unknown>) => profile;

export const BLOOD_GROUP_LOCKED = 'A hospital lab confirmed your blood group, so it can only be changed by a lab result.';

// GET /donor/profile
export const getDonorProfile = async (req: AuthRequest, res: Response) => {
    try {
        const row = (await query(PROFILE_SQL, [req.user!.id])).rows[0];
        if (!row) return res.status(404).json({ message: 'Donor profile not found.' });
        res.json(publicProfile(row));
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

/**
 * PUT /donor/profile  { name?, phone?, city?, gender?, dob?, blood_group? }
 * Updates the website profile and the donor's network entry together. A new
 * phone moves the existing entry (with its history, rest period and
 * lab-confirmed group) instead of starting a new one; a phone already on
 * another account is refused. A new city drops the old exact location.
 */
export const updateDonorProfile = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const b = req.body;
    try {
        const current = (await query(PROFILE_SQL, [userId])).rows[0];
        if (!current) return res.status(404).json({ message: 'Donor profile not found.' });
        if (b.blood_group && b.blood_group !== current.blood_group && current.blood_group_verified) {
            return res.status(409).json({ message: BLOOD_GROUP_LOCKED });
        }

        let phone: string | null = current.phone;
        if (b.phone !== undefined) {
            phone = toE164(b.phone);
            if (!phone) return res.status(400).json({ message: 'Enter a valid mobile number.' });
            const holder = (await query('SELECT user_id FROM network_donors WHERE phone = $1', [phone])).rows[0];
            if (holder && holder.user_id !== userId) {
                return res.status(409).json({
                    message: holder.user_id == null
                        ? 'This number is already on LifeLink through SMS or USSD. Contact us from the Support page to link it to your account.'
                        : PHONE_TAKEN,
                });
            }
        }
        const cityChanged = b.city !== undefined && b.city.toLowerCase() !== String(current.city ?? '').trim().toLowerCase();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (b.name !== undefined) await client.query('UPDATE users SET name = $2 WHERE id = $1', [userId, b.name]);
            await client.query(
                `UPDATE donors SET phone = $2, city = COALESCE($3, city), gender = COALESCE($4, gender), dob = COALESCE($5::date, dob),
                     blood_group = COALESCE($6, blood_group),
                     latitude = CASE WHEN $7::boolean THEN NULL ELSE latitude END, longitude = CASE WHEN $7::boolean THEN NULL ELSE longitude END
                 WHERE user_id = $1`,
                [userId, phone, b.city ?? null, b.gender ?? null, b.dob ?? null, b.blood_group ?? null, cityChanged]
            );
            if (current.entry_id) {
                await client.query(
                    `UPDATE network_donors SET name = COALESCE($2, name), phone = $3, city = COALESCE($4, city), gender = COALESCE($5, gender),
                         blood_group = CASE WHEN blood_group_verified_at IS NULL THEN COALESCE($6, blood_group) ELSE blood_group END,
                         latitude = CASE WHEN $7::boolean THEN NULL ELSE latitude END, longitude = CASE WHEN $7::boolean THEN NULL ELSE longitude END,
                         updated_at = now()
                     WHERE id = $1`,
                    [current.entry_id, b.name ?? null, phone, b.city ?? null, b.gender ?? null, b.blood_group ?? null, cityChanged]
                );
            }
            await client.query('COMMIT');
        } catch (err: any) {
            await client.query('ROLLBACK').catch(() => { });
            // Someone took the number between the check and the update
            if (err?.code === '23505') return res.status(409).json({ message: PHONE_TAKEN });
            throw err;
        } finally {
            client.release();
        }
        res.json(publicProfile((await query(PROFILE_SQL, [userId])).rows[0]));
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
