/**
 * Donation certificates. A donor asks for one for a donation LifeLink itself
 * recorded (on the website, or confirmed by the hospital on the donor
 * network). LifeLink issues a code, printed on the certificate, that anyone
 * can check at /certificate/<code>, so a certificate cannot simply be made up.
 * The website draws the PDF (so names in any script print correctly). This
 * replaced a public Google Apps Script that would email a "certificate" to
 * any address for anyone who called it.
 */
import { Request, Response } from 'express';
import { randomInt } from 'crypto';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { frontendUrl } from '../network/engine';

// 31 symbols: no 0/O or 1/I/L to misread on paper
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CERTIFICATE_CODE = /^LC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

export const newCertificateCode = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    return `LC-${s.slice(0, 4)}-${s.slice(4)}`;
};

/** "Kavya S." from "Kavya Sood": enough to match a certificate to its holder. */
export const shortName = (name: unknown) => {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'LifeLink donor';
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.` : parts[0]!;
};

const CERTIFICATE_COLUMNS = `code, donor_name, hospital_name, hospital_city, to_char(donated_on, 'YYYY-MM-DD') AS donated_on, issued_at`;

const serverError = (res: Response, err: unknown) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
};

interface DonationRecord {
    donation_id: number | null;
    match_id: number | null;
    hospital_name: string;
    hospital_city: string | null;
    donated_on: string;
}

/** The donation, from LifeLink's own records, if it is this donor's. */
const findDonation = async (donorId: number, body: { donation_id?: number; match_id?: number }): Promise<DonationRecord | undefined> => {
    if (body.match_id) {
        return (await query(
            `SELECT dn.id AS donation_id, m.id AS match_id, m.hospital_name, m.hospital_city,
                    COALESCE(to_char(dn.donation_date, 'YYYY-MM-DD'),
                             to_char(COALESCE(m.responded_at, m.updated_at) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')) AS donated_on
             FROM network_matches m JOIN network_donors d ON d.id = m.donor_id
             LEFT JOIN donations dn ON dn.network_match_id = m.id AND dn.donor_id = $2
             WHERE m.id = $1 AND m.status = 'donated' AND d.user_id = $2`,
            [body.match_id, donorId]
        )).rows[0];
    }
    return (await query(
        `SELECT dn.id AS donation_id, dn.network_match_id AS match_id, h.hospital_name, h.city AS hospital_city,
                to_char(dn.donation_date, 'YYYY-MM-DD') AS donated_on
         FROM donations dn JOIN hospitals h ON h.user_id = dn.hospital_id
         WHERE dn.id = $1 AND dn.donor_id = $2`,
        [body.donation_id, donorId]
    )).rows[0];
};

const existingCertificate = async (donorId: number, d: DonationRecord) => (await query(
    `SELECT ${CERTIFICATE_COLUMNS} FROM donation_certificates
     WHERE donor_user_id = $1 AND ((network_match_id = $2::int) OR (donation_id = $3::int))
     ORDER BY issued_at LIMIT 1`,
    [donorId, d.match_id, d.donation_id]
)).rows[0];

// POST /donor/certificates  { donation_id } or { match_id }
// The same donation always gets the same certificate, even if the donor asks
// from the website record one day and the network record the next.
export const issueCertificate = async (req: AuthRequest, res: Response) => {
    const donorId = req.user!.id;
    try {
        const donation = await findDonation(donorId, req.body);
        if (!donation) return res.status(404).json({ message: 'There is no such donation on your account.' });
        let certificate = await existingCertificate(donorId, donation);
        if (!certificate) {
            const donor = (await query('SELECT name FROM users WHERE id = $1', [donorId])).rows[0];
            for (let attempt = 0; attempt < 5 && !certificate; attempt++) {
                certificate = (await query(
                    `INSERT INTO donation_certificates (code, donor_user_id, donation_id, network_match_id, donor_name, hospital_name, hospital_city, donated_on)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
                     ON CONFLICT DO NOTHING
                     RETURNING ${CERTIFICATE_COLUMNS}`,
                    [newCertificateCode(), donorId, donation.donation_id, donation.match_id, donor?.name ?? 'LifeLink donor',
                        donation.hospital_name, donation.hospital_city, donation.donated_on]
                )).rows[0];
                // Nothing inserted: the code was taken (try another), or this donation just got one
                certificate ??= await existingCertificate(donorId, donation);
            }
            if (!certificate) throw new Error('Could not issue a certificate code.');
        }
        res.json({ ...certificate, verify_url: `${frontendUrl()}/certificate/${certificate.code}` });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /certificates/:code  (public): confirms a certificate is real
export const verifyCertificate = async (req: Request, res: Response) => {
    const code = String(req.params.code ?? '').trim().toUpperCase();
    res.set('Cache-Control', 'no-store');
    if (!CERTIFICATE_CODE.test(code)) return res.status(404).json({ valid: false, message: 'That is not a LifeLink certificate code.' });
    try {
        const row = (await query(`SELECT ${CERTIFICATE_COLUMNS} FROM donation_certificates WHERE code = $1`, [code])).rows[0];
        if (!row) return res.status(404).json({ valid: false, message: 'No LifeLink certificate has this code.' });
        // First name and initial only: the code alone should not reveal who someone is
        res.json({
            valid: true, code: row.code, donor: shortName(row.donor_name),
            hospital_name: row.hospital_name, hospital_city: row.hospital_city, donated_on: row.donated_on,
        });
    } catch (err) {
        serverError(res, err);
    }
};
