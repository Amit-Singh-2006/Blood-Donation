import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { AdminRequest } from '../middleware/requireAdmin';
import { AuthRequest } from '../middleware/authMiddleware';
import { sessionToken } from '../middleware/session';
import { AdminScope, normalizeCity } from '../utils/jurisdiction';
import { broadcastCampaign, networkConfigured, toE164 } from '../services/donorNetwork';

const FRONTEND = (process.env.FRONTEND_URL || 'https://blood-donation-frontend-delta.vercel.app').split(',')[0]!.trim().replace(/\/$/, '');

const COLUMNS = `c.id, c.name, c.description, c.city, c.state, c.venue, c.address, c.map_url, c.days,
  to_char(c.start_date, 'YYYY-MM-DD') AS start_date, to_char(c.start_date + (c.days - 1), 'YYYY-MM-DD') AS end_date,
  to_char(c.start_time, 'HH24:MI') AS start_time, to_char(c.end_time, 'HH24:MI') AS end_time,
  c.rewards, c.refreshments, c.contact_phone, c.target_donors, c.status`;

const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
const inScope = (scope: AdminScope | undefined, city: string) => !!scope && (scope.isNational || scope.cities.includes(normalizeCity(city)));
const clock = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const when = (c: any) => `${c.days > 1 ? `${day(c.start_date)} to ${day(c.end_date)}` : day(c.start_date)}, ${clock(c.start_time)} to ${clock(c.end_time)}`;

const findCampaign = async (id: unknown) => {
    const n = Number(id);
    return Number.isInteger(n) ? (await query(`SELECT ${COLUMNS} FROM campaigns c WHERE c.id = $1`, [n])).rows[0] ?? null : null;
};

/** Alerts every donor in the campaign's city: in the app (the donor's Campaigns tab), and by SMS, WhatsApp and email through n8n. */
const alertDonors = async (c: any) => {
    const donors = (await query(
        `SELECT u.name, u.email, d.phone FROM users u JOIN donors d ON d.user_id = u.id
         WHERE u.role = 'donor' AND lower(trim(d.city)) = lower(trim($1))`, [c.city])).rows;
    let error: string | null = null;
    if (donors.length && !networkConfigured()) error = 'The alert service is not configured';
    else if (donors.length) {
        try {
            await broadcastCampaign({
                campaign: { name: c.name, city: c.city, venue: c.venue, address: c.address, when: when(c), rewards: c.rewards, refreshments: c.refreshments, contact_phone: c.contact_phone, description: c.description },
                register_url: `${FRONTEND}/campaign/${c.id}`,
                recipients: donors.map((d: any) => ({ name: d.name, email: d.email, phone: toE164(d.phone) })),
            });
        } catch (err: any) {
            error = err?.message || 'The alert service did not respond';
        }
    }
    await query('UPDATE campaigns SET alerted_count = $2, alert_error = $3 WHERE id = $1', [c.id, donors.length, error]);
    return { alerted: donors.length, alert_error: error };
};

// ── Admin ──────────────────────────────────────────────

export const createCampaign = async (req: AdminRequest, res: Response) => {
    const b = req.body;
    if (!inScope(req.adminScope, b.city)) return res.status(403).json({ message: 'You can only run campaigns in the cities you manage.' });
    if (b.start_date < todayIST()) return res.status(400).json({ message: 'The campaign cannot start in the past.' });
    if (b.end_time <= b.start_time) return res.status(400).json({ message: 'The end time must be after the start time.' });
    try {
        const { rows } = await query(
            `INSERT INTO campaigns (created_by, name, description, city, state, venue, address, map_url, start_date, days, start_time, end_time, rewards, refreshments, contact_phone, target_donors)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
            [req.user!.id, b.name, b.description || null, b.city, b.state || null, b.venue, b.address || null, b.map_url || null,
                b.start_date, b.days, b.start_time, b.end_time, b.rewards || null, b.refreshments || null, b.contact_phone || null, b.target_donors ?? null]);
        const campaign = await findCampaign(rows[0].id);
        res.status(201).json({ campaign, ...(await alertDonors(campaign)) });
    } catch (err: any) {
        console.error('createCampaign failed:', err.message);
        res.status(500).json({ message: 'Could not create the campaign' });
    }
};

export const listCampaigns = async (req: AdminRequest, res: Response) => {
    try {
        const { rows } = await query(
            `SELECT ${COLUMNS}, c.alerted_count, c.alert_error,
               (SELECT count(*)::int FROM campaign_registrations r WHERE r.campaign_id = c.id) AS registered,
               (SELECT count(*)::int FROM campaign_registrations r WHERE r.campaign_id = c.id AND r.attended) AS attended,
               (SELECT count(*)::int FROM campaign_registrations r WHERE r.campaign_id = c.id AND r.donated) AS donated,
               (SELECT coalesce(sum(r.volume_ml), 0)::int FROM campaign_registrations r WHERE r.campaign_id = c.id AND r.donated) AS volume_ml,
               (SELECT round(avg(v.rating)::numeric, 1)::float FROM reviews v WHERE v.target_type = 'campaign' AND v.target_id = c.id) AS rating,
               (SELECT count(*)::int FROM reviews v WHERE v.target_type = 'campaign' AND v.target_id = c.id) AS reviews
             FROM campaigns c ORDER BY c.start_date DESC, c.id DESC LIMIT 200`);
        res.json(rows.filter((c: any) => inScope(req.adminScope, c.city)));
    } catch (err: any) {
        console.error('listCampaigns failed:', err.message);
        res.status(500).json({ message: 'Could not load campaigns' });
    }
};

const ownCampaign = async (req: AdminRequest, res: Response) => {
    const c = await findCampaign(req.params.id);
    if (!c || !inScope(req.adminScope, c.city)) { res.status(404).json({ message: 'Campaign not found' }); return null; }
    return c;
};

export const listRegistrations = async (req: AdminRequest, res: Response) => {
    try {
        const c = await ownCampaign(req, res);
        if (!c) return;
        const { rows } = await query(
            `SELECT id, name, email, phone, blood_group, gender, to_char(dob, 'YYYY-MM-DD') AS dob, weight_kg, city,
               to_char(preferred_date, 'YYYY-MM-DD') AS preferred_date, preferred_slot, to_char(last_donation_date, 'YYYY-MM-DD') AS last_donation_date,
               attended, donated, volume_ml, remarks, created_at, donor_user_id IS NOT NULL AS is_member
             FROM campaign_registrations WHERE campaign_id = $1 ORDER BY created_at DESC`, [c.id]);
        res.json({ campaign: c, registrations: rows });
    } catch (err: any) {
        console.error('listRegistrations failed:', err.message);
        res.status(500).json({ message: 'Could not load registrations' });
    }
};

export const markAttendance = async (req: AdminRequest, res: Response) => {
    try {
        const c = await ownCampaign(req, res);
        if (!c) return;
        const { attended, donated, volume_ml, remarks } = req.body;
        const gave = attended && donated;
        const { rows } = await query(
            `UPDATE campaign_registrations SET attended = $3, donated = $4, volume_ml = $5, remarks = $6, marked_at = now()
             WHERE id = $2 AND campaign_id = $1 RETURNING id, donor_user_id, attended, donated, volume_ml, remarks`,
            [c.id, Number(req.params.regId), attended, gave, gave ? volume_ml ?? null : null, remarks || null]);
        if (!rows[0]) return res.status(404).json({ message: 'Registration not found' });
        // A donation at the camp restarts the member's 90/120-day gap
        if (gave && rows[0].donor_user_id) {
            await query(`UPDATE donors SET last_donation_date = GREATEST(coalesce(last_donation_date, '1900-01-01'::date), CURRENT_DATE) WHERE user_id = $1`, [rows[0].donor_user_id]);
        }
        res.json(rows[0]);
    } catch (err: any) {
        console.error('markAttendance failed:', err.message);
        res.status(500).json({ message: 'Could not save attendance' });
    }
};

export const cancelCampaign = async (req: AdminRequest, res: Response) => {
    try {
        const c = await ownCampaign(req, res);
        if (!c) return;
        await query(`UPDATE campaigns SET status = 'cancelled' WHERE id = $1`, [c.id]);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ message: 'Could not cancel the campaign' });
    }
};

// ── Public and donors ──────────────────────────────────

export const getPublicCampaign = async (req: Request, res: Response) => {
    try {
        const c = await findCampaign(req.params.id);
        if (!c) return res.status(404).json({ message: 'Campaign not found' });
        res.json(c);
    } catch (err: any) {
        res.status(500).json({ message: 'Could not load the campaign' });
    }
};

/** The signed-in donor, if this browser has one (registration works without an account too). */
const donorIdFrom = (req: Request): number | null => {
    const token = sessionToken(req);
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        return decoded?.role === 'donor' ? Number(decoded.id) : null;
    } catch {
        return null;
    }
};

export const registerForCampaign = async (req: Request, res: Response) => {
    try {
        const c = await findCampaign(req.params.id);
        if (!c) return res.status(404).json({ message: 'Campaign not found' });
        if (c.status !== 'active') return res.status(409).json({ message: 'This campaign has been cancelled.' });
        if (c.end_date < todayIST()) return res.status(409).json({ message: 'This campaign has already ended.' });

        const b = req.body;
        const phone = toE164(b.phone);
        if (!phone) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
        const age = Math.floor(daysBetween(b.dob, c.start_date) / 365.25);
        if (age < 18 || age > 65) return res.status(400).json({ message: 'Donors must be 18 to 65 years old on the campaign day.' });
        if (b.weight_kg < 45) return res.status(400).json({ message: 'Donors must weigh at least 45 kg.' });
        if (b.gender === 'female' && b.health?.not_pregnant !== true) {
            return res.status(400).json({ message: 'Please confirm you are not pregnant or breastfeeding and have not given birth in the last 12 months.' });
        }
        if (b.last_donation_date) {
            const need = b.gender === 'female' ? 120 : 90;
            if (daysBetween(b.last_donation_date, c.end_date) < need) {
                return res.status(400).json({ message: `You need ${need} days between donations, so you cannot donate at this campaign yet.` });
            }
        }
        if (b.preferred_date && (b.preferred_date < c.start_date || b.preferred_date > c.end_date)) {
            return res.status(400).json({ message: 'Choose a day when the campaign is running.' });
        }

        const { rows } = await query(
            `INSERT INTO campaign_registrations (campaign_id, donor_user_id, name, email, phone, blood_group, gender, dob, weight_kg, city, preferred_date, preferred_slot, last_donation_date, health)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (campaign_id, phone) DO NOTHING RETURNING id`,
            [c.id, donorIdFrom(req), b.name, b.email.toLowerCase(), phone, b.blood_group, b.gender, b.dob, b.weight_kg, b.city || null,
                b.preferred_date || null, b.preferred_slot || null, b.last_donation_date || null, JSON.stringify(b.health)]);
        if (!rows[0]) return res.status(409).json({ message: 'This mobile number is already registered for this campaign.' });
        res.status(201).json({ id: rows[0].id, campaign: c });
    } catch (err: any) {
        console.error('registerForCampaign failed:', err.message);
        res.status(500).json({ message: 'Could not register you. Please try again.' });
    }
};

/** Campaigns for the donor's city, plus any campaign they registered for, and their profile to prefill the form. */
export const myCampaigns = async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'donor') return res.status(403).json({ message: 'Donors only' });
    try {
        const me = (await query(
            `SELECT u.name, u.email, d.phone, d.city, d.blood_group, d.gender, to_char(d.dob, 'YYYY-MM-DD') AS dob, to_char(d.last_donation_date, 'YYYY-MM-DD') AS last_donation_date
             FROM users u LEFT JOIN donors d ON d.user_id = u.id WHERE u.id = $1`, [req.user.id])).rows[0] ?? null;
        const { rows } = await query(
            `SELECT ${COLUMNS}, r.id AS registration_id, r.attended, r.donated
             FROM campaigns c LEFT JOIN campaign_registrations r ON r.campaign_id = c.id AND (r.donor_user_id = $1 OR r.phone = $3)
             WHERE r.id IS NOT NULL OR (c.status = 'active' AND c.start_date + (c.days - 1) >= CURRENT_DATE AND lower(trim(c.city)) = lower(trim($2)))
             ORDER BY c.start_date DESC LIMIT 50`, [req.user.id, me?.city || '', toE164(me?.phone) || '']);
        res.json({ profile: me, campaigns: rows });
    } catch (err: any) {
        console.error('myCampaigns failed:', err.message);
        res.status(500).json({ message: 'Could not load campaigns' });
    }
};
