import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

const units = (n: number) => `${n} unit${n === 1 ? '' : 's'}`;

/** What this donor or hospital can review, their own reviews, and the reviews written about them. */
export const myReviews = async (req: AuthRequest, res: Response) => {
    const { id, role } = req.user!;
    if (role !== 'donor' && role !== 'hospital') return res.status(403).json({ message: 'Reviews are for donors and hospitals' });
    try {
        let items: any[];
        if (role === 'donor') {
            const donations = await query(
                `SELECT d.id, d.hospital_id, d.units, to_char(d.donation_date, 'YYYY-MM-DD') AS date, coalesce(h.hospital_name, u.name) AS title, h.city
                 FROM donations d JOIN users u ON u.id = d.hospital_id LEFT JOIN hospitals h ON h.user_id = d.hospital_id
                 WHERE d.donor_id = $1 ORDER BY d.donation_date DESC LIMIT 50`, [id]);
            const campaigns = await query(
                `SELECT c.id, c.name, c.city, to_char(c.start_date, 'YYYY-MM-DD') AS date, r.donated
                 FROM campaign_registrations r JOIN campaigns c ON c.id = r.campaign_id
                 WHERE r.donor_user_id = $1 AND c.start_date <= CURRENT_DATE ORDER BY c.start_date DESC LIMIT 50`, [id]);
            items = [
                ...donations.rows.map((d: any) => ({ target_type: 'hospital', target_id: d.hospital_id, context: `donation:${d.id}`, title: d.title, subtitle: `Hospital donation · ${units(d.units)}${d.city ? ` · ${d.city}` : ''}`, date: d.date })),
                ...campaigns.rows.map((c: any) => ({ target_type: 'campaign', target_id: c.id, context: `campaign:${c.id}`, title: c.name, subtitle: `Donation campaign · ${c.city}${c.donated ? ' · you donated' : ''}`, date: c.date })),
            ];
        } else {
            const donations = await query(
                `SELECT d.id, d.donor_id, d.units, to_char(d.donation_date, 'YYYY-MM-DD') AS date, u.name, dn.blood_group
                 FROM donations d JOIN users u ON u.id = d.donor_id LEFT JOIN donors dn ON dn.user_id = d.donor_id
                 WHERE d.hospital_id = $1 ORDER BY d.donation_date DESC LIMIT 100`, [id]);
            items = donations.rows.map((d: any) => ({ target_type: 'donor', target_id: d.donor_id, context: `donation:${d.id}`, title: d.name, subtitle: `${d.blood_group ? `${d.blood_group} donor · ` : ''}${units(d.units)} donated`, date: d.date }));
        }
        items.sort((a, b) => (a.date < b.date ? 1 : -1));

        const mine = (await query('SELECT target_type, target_id, context, rating, comment FROM reviews WHERE reviewer_id = $1', [id])).rows;
        const key = (r: any) => `${r.target_type}:${r.target_id}:${r.context}`;
        const byKey = new Map(mine.map((r: any) => [key(r), { rating: r.rating, comment: r.comment }]));
        const received = (await query(
            `SELECT v.rating, v.comment, to_char(v.updated_at, 'YYYY-MM-DD') AS date, coalesce(h.hospital_name, u.name) AS from_name
             FROM reviews v JOIN users u ON u.id = v.reviewer_id LEFT JOIN hospitals h ON h.user_id = v.reviewer_id
             WHERE v.target_type = $2 AND v.target_id = $1 ORDER BY v.updated_at DESC LIMIT 100`, [id, role])).rows;

        res.json({ to_review: items.map((t) => ({ ...t, my_review: byKey.get(key(t)) ?? null })), received });
    } catch (err: any) {
        console.error('myReviews failed:', err.message);
        res.status(500).json({ message: 'Could not load reviews' });
    }
};

/** Donors review hospitals they donated at and campaigns they joined; hospitals review donors who donated with them. */
export const saveReview = async (req: AuthRequest, res: Response) => {
    const { id, role } = req.user!;
    const { target_type, target_id, context, rating, comment } = req.body;
    const [kind, ref] = String(context).split(':');
    const refId = Number(ref);
    try {
        let allowed = false;
        if (role === 'donor' && target_type === 'hospital' && kind === 'donation') {
            allowed = !!(await query('SELECT 1 FROM donations WHERE id = $1 AND donor_id = $2 AND hospital_id = $3', [refId, id, target_id])).rows[0];
        } else if (role === 'donor' && target_type === 'campaign' && kind === 'campaign' && refId === target_id) {
            allowed = !!(await query(
                `SELECT 1 FROM campaign_registrations r JOIN campaigns c ON c.id = r.campaign_id
                 WHERE c.id = $1 AND r.donor_user_id = $2 AND c.start_date <= CURRENT_DATE`, [refId, id])).rows[0];
        } else if (role === 'hospital' && target_type === 'donor' && kind === 'donation') {
            allowed = !!(await query('SELECT 1 FROM donations WHERE id = $1 AND hospital_id = $2 AND donor_id = $3', [refId, id, target_id])).rows[0];
        }
        if (!allowed) return res.status(403).json({ message: 'You can only review a donation or campaign you took part in.' });

        await query(
            `INSERT INTO reviews (reviewer_id, target_type, target_id, context, rating, comment) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (reviewer_id, target_type, target_id, context) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()`,
            [id, target_type, target_id, context, rating, comment || null]);
        res.json({ ok: true });
    } catch (err: any) {
        console.error('saveReview failed:', err.message);
        res.status(500).json({ message: 'Could not save your review' });
    }
};
