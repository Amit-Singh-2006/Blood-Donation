/**
 * Hospital verification with documents. A hospital uploads its registration
 * certificate and an authorisation letter (plus its blood centre licence if it
 * has one), fills in the details an admin needs to check them, and sends them
 * for review. An admin in its jurisdiction opens the documents, checks them
 * against the public registers, phones the hospital on a publicly listed
 * number, and approves it or asks for changes. Only verified hospitals can
 * alert donors, and every step is logged.
 */
import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { AdminRequest } from '../middleware/requireAdmin';
import { hospitalScopeSql } from '../utils/jurisdiction';
import {
    DOCUMENT_LABELS, DocumentKind, MAX_DOCUMENT_BYTES, REQUIRED_DOCUMENTS, checkDocument, documentsDigest, isDocumentKind, sendDocument,
} from '../utils/documents';
import { background } from '../utils/background';
import { sendAccountEmail } from '../services/donorNetwork';
import { frontendUrl } from '../network/engine';

const LOCKED = 'Your hospital is verified, so its documents are locked. Ask your LifeLink admin if something needs to change.';

const serverError = (res: Response, err: unknown) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
};

const log = (hospitalId: number, actorId: number | undefined, action: string, detail?: string | null, checks?: unknown) =>
    query(
        'INSERT INTO hospital_verification_log (hospital_id, actor_id, action, detail, checks) VALUES ($1, $2, $3, $4, $5)',
        [hospitalId, actorId ?? null, action, detail ?? null, checks ? JSON.stringify(checks) : null]
    );

const DOCUMENTS_JSON = `COALESCE((SELECT json_agg(json_build_object('kind', d.kind, 'content_type', d.content_type,
        'size_bytes', d.size_bytes, 'uploaded_at', d.uploaded_at, 'sha256', d.sha256) ORDER BY d.kind)
    FROM hospital_documents d WHERE d.hospital_id = h.user_id), '[]'::json)`;

interface StoredDocument { kind: DocumentKind; content_type: string; size_bytes: number; uploaded_at: string; sha256: string }

const missingDocuments = (documents: StoredDocument[]) =>
    REQUIRED_DOCUMENTS.filter((kind) => !documents.some((d) => d.kind === kind));

/** The file list without fingerprints (only the digest of them leaves the server). */
const publicDocuments = (documents: StoredDocument[]) => documents.map(({ sha256, ...rest }) => rest);

/** The hospital's own view of its verification. */
const loadVerification = async (hospitalId: number) => {
    const { rows } = await query(
        `SELECT h.verification_status, h.verification_note, h.verification_submitted_at, h.verified_at,
                h.registration_number, h.registration_authority, h.hfr_id, h.blood_centre_licence,
                h.authorised_person, h.authorised_designation, ${DOCUMENTS_JSON} AS documents
         FROM hospitals h WHERE h.user_id = $1`,
        [hospitalId]
    );
    const h = rows[0];
    if (!h) return null;
    const documents: StoredDocument[] = h.documents ?? [];
    return {
        status: h.verification_status as string,
        note: h.verification_note ?? null,
        submitted_at: h.verification_submitted_at ?? null,
        verified_at: h.verified_at ?? null,
        // Verified before LifeLink asked hospitals for documents
        verified_without_documents: h.verification_status === 'verified' && !h.verified_at,
        can_edit: h.verification_status !== 'verified',
        details: {
            registration_number: h.registration_number ?? '',
            registration_authority: h.registration_authority ?? '',
            hfr_id: h.hfr_id ?? '',
            blood_centre_licence: h.blood_centre_licence ?? '',
            authorised_person: h.authorised_person ?? '',
            authorised_designation: h.authorised_designation ?? '',
        },
        documents: publicDocuments(documents),
        missing_documents: missingDocuments(documents),
        max_bytes: MAX_DOCUMENT_BYTES,
    };
};

// ── Hospital side ─────────────────────────────────────────────────────────

// GET /hospital/verification
export const getVerification = async (req: AuthRequest, res: Response) => {
    try {
        const state = await loadVerification(req.user!.id);
        if (!state) return res.status(404).json({ message: 'Hospital profile not found.' });
        res.json(state);
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /hospital/verification/documents/:kind  (the file itself is the body)
export const uploadVerificationDocument = async (req: AuthRequest, res: Response) => {
    const kind = req.params.kind;
    if (!isDocumentKind(kind)) return res.status(404).json({ message: 'Unknown document.' });
    const check = checkDocument(req.body, req.get('content-type'));
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const hospitalId = req.user!.id;
    try {
        const file = req.body as Buffer;
        // Never once verified, even if an admin approves at this very moment
        const { rows } = await query(
            `INSERT INTO hospital_documents (hospital_id, kind, content_type, size_bytes, sha256, data)
             SELECT h.user_id, $2, $3, $4, $5, $6 FROM hospitals h WHERE h.user_id = $1 AND h.verification_status <> 'verified'
             ON CONFLICT (hospital_id, kind) DO UPDATE SET content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes,
                 sha256 = EXCLUDED.sha256, data = EXCLUDED.data, uploaded_at = now()
             RETURNING kind, content_type, size_bytes, uploaded_at`,
            [hospitalId, kind, check.type, file.length, check.sha256, file]
        );
        if (!rows[0]) {
            const exists = (await query('SELECT 1 FROM hospitals WHERE user_id = $1', [hospitalId])).rows[0];
            return exists ? res.status(409).json({ message: LOCKED }) : res.status(404).json({ message: 'Hospital profile not found.' });
        }
        await log(hospitalId, hospitalId, 'uploaded', DOCUMENT_LABELS[kind]);
        res.status(201).json(rows[0]);
    } catch (err) {
        serverError(res, err);
    }
};

// DELETE /hospital/verification/documents/:kind
export const removeVerificationDocument = async (req: AuthRequest, res: Response) => {
    const kind = req.params.kind;
    if (!isDocumentKind(kind)) return res.status(404).json({ message: 'Unknown document.' });
    const hospitalId = req.user!.id;
    try {
        const { rowCount } = await query(
            `DELETE FROM hospital_documents d USING hospitals h
             WHERE d.hospital_id = $1 AND d.kind = $2 AND h.user_id = d.hospital_id AND h.verification_status <> 'verified'`,
            [hospitalId, kind]
        );
        if (!rowCount) {
            const status = (await query('SELECT verification_status FROM hospitals WHERE user_id = $1', [hospitalId])).rows[0]?.verification_status;
            return status === 'verified' ? res.status(409).json({ message: LOCKED }) : res.status(404).json({ message: 'No such document.' });
        }
        await log(hospitalId, hospitalId, 'removed', DOCUMENT_LABELS[kind]);
        res.json({ removed: kind });
    } catch (err) {
        serverError(res, err);
    }
};

// GET /hospital/verification/documents/:kind: the hospital's own file
export const downloadOwnDocument = async (req: AuthRequest, res: Response) => {
    const kind = req.params.kind;
    if (!isDocumentKind(kind)) return res.status(404).json({ message: 'Unknown document.' });
    try {
        const { rows } = await query('SELECT kind, content_type, data FROM hospital_documents WHERE hospital_id = $1 AND kind = $2', [req.user!.id, kind]);
        if (!rows[0]) return res.status(404).json({ message: 'No such document.' });
        sendDocument(res, req.user!.id, rows[0]);
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /hospital/verification: saves the details and sends everything for review
export const submitVerification = async (req: AuthRequest, res: Response) => {
    const hospitalId = req.user!.id;
    const b = req.body;
    try {
        const state = await loadVerification(hospitalId);
        if (!state) return res.status(404).json({ message: 'Hospital profile not found.' });
        if (state.status === 'verified') return res.status(409).json({ message: 'Your hospital is already verified.' });
        if (state.missing_documents.length) {
            return res.status(400).json({ message: `Upload your ${state.missing_documents.map((k) => DOCUMENT_LABELS[k]).join(' and ')} first.` });
        }
        if (b.blood_centre_licence && !state.documents.some((d) => d.kind === 'blood_centre_licence')) {
            return res.status(400).json({ message: 'Upload your blood centre licence too, or leave its number empty.' });
        }
        const { rowCount } = await query(
            `UPDATE hospitals SET registration_number = $2, registration_authority = $3, hfr_id = NULLIF($4, ''),
                 blood_centre_licence = NULLIF($5, ''), authorised_person = $6, authorised_designation = $7,
                 verification_status = 'pending', verification_submitted_at = now(), verification_note = NULL
             WHERE user_id = $1 AND verification_status <> 'verified'`,
            [hospitalId, b.registration_number, b.registration_authority, b.hfr_id, b.blood_centre_licence, b.authorised_person, b.authorised_designation]
        );
        if (!rowCount) return res.status(409).json({ message: 'Your hospital is already verified.' });
        await log(hospitalId, hospitalId, 'submitted', 'Declared the documents genuine and the sender authorised');
        res.json(await loadVerification(hospitalId));
    } catch (err) {
        serverError(res, err);
    }
};

// ── Admin side ────────────────────────────────────────────────────────────

const parseIds = (req: AdminRequest) => {
    const hospitalId = Number(req.params.id);
    return Number.isInteger(hospitalId) && hospitalId > 0 ? hospitalId : null;
};

/** Everything an admin reviews, for the hospitals in their jurisdiction. */
export const reviewColumns = `h.verification_status, h.verification_note, h.verification_submitted_at, h.verified_at,
    h.registration_authority, h.hfr_id, h.blood_centre_licence, h.authorised_person, h.authorised_designation,
    (SELECT name FROM users WHERE id = h.verified_by) AS verified_by_name,
    ${DOCUMENTS_JSON} AS documents,
    COALESCE((SELECT json_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT l.action, l.detail, l.created_at, a.name AS actor_name
        FROM hospital_verification_log l LEFT JOIN users a ON a.id = l.actor_id
        WHERE l.hospital_id = h.user_id AND l.action <> 'viewed' ORDER BY l.created_at DESC LIMIT 10) x), '[]'::json) AS history`;

/** Turns a row with reviewColumns into what the admin dashboard shows. */
export const toReview = (row: any) => {
    const documents: StoredDocument[] = row.documents ?? [];
    const { documents: _docs, ...rest } = row;
    return {
        ...rest,
        verified_without_documents: row.verification_status === 'verified' && !row.verified_at,
        documents: publicDocuments(documents),
        missing_documents: missingDocuments(documents),
        documents_digest: documentsDigest(documents),
    };
};

// GET /admin/hospitals/:id/documents/:kind
export const downloadHospitalDocument = async (req: AdminRequest, res: Response) => {
    const hospitalId = parseIds(req);
    const kind = req.params.kind;
    if (!hospitalId || !isDocumentKind(kind)) return res.status(404).json({ message: 'No such document.' });
    try {
        const params: unknown[] = [hospitalId, kind];
        const { rows } = await query(
            `SELECT d.kind, d.content_type, d.data FROM hospital_documents d JOIN hospitals h ON h.user_id = d.hospital_id
             WHERE d.hospital_id = $1 AND d.kind = $2 AND ${hospitalScopeSql(req.adminScope!, params)}`,
            params
        );
        if (!rows[0]) return res.status(404).json({ message: 'No such document in your jurisdiction.' });
        // Who opened which document, and when: approving needs it
        await log(hospitalId, req.adminScope!.userId, 'viewed', DOCUMENT_LABELS[kind]);
        sendDocument(res, hospitalId, rows[0]);
    } catch (err) {
        serverError(res, err);
    }
};

// PUT /admin/hospitals/:id/verification  { action: approve | request_changes | revoke, ... }
// Only verified hospitals can dispatch requests that alert donors. City admins
// can only decide on hospitals in their own jurisdiction.
export const decideHospitalVerification = async (req: AdminRequest, res: Response) => {
    const hospitalId = parseIds(req);
    if (!hospitalId) return res.status(400).json({ message: 'Invalid hospital id.' });
    const adminId = req.adminScope!.userId;
    const body = req.body;
    try {
        const params: unknown[] = [hospitalId];
        const { rows } = await query(
            `SELECT h.user_id, h.hospital_name, h.verification_status, u.email, ${DOCUMENTS_JSON} AS documents
             FROM hospitals h JOIN users u ON u.id = h.user_id
             WHERE h.user_id = $1 AND ${hospitalScopeSql(req.adminScope!, params)}`,
            params
        );
        const h = rows[0];
        if (!h) return res.status(404).json({ message: 'Hospital not found in your jurisdiction.' });
        const documents: StoredDocument[] = h.documents ?? [];

        let decision: 'approved' | 'changes_requested' | 'revoked';
        if (body.action === 'approve') {
            if (h.verification_status !== 'pending') {
                return res.status(409).json({ message: 'Only a hospital that has sent its documents for review can be approved.' });
            }
            if (missingDocuments(documents).length) return res.status(409).json({ message: 'This hospital has not uploaded all the required documents.' });
            if (documentsDigest(documents) !== body.documents_digest) {
                return res.status(409).json({ message: 'The hospital changed its documents while you were reviewing. Open them again before approving.' });
            }
            // This admin must have opened each document since it was last uploaded
            const views = (await query(
                `SELECT detail, max(created_at) AS at FROM hospital_verification_log
                 WHERE hospital_id = $1 AND actor_id = $2 AND action = 'viewed' GROUP BY detail`,
                [hospitalId, adminId]
            )).rows;
            const unopened = documents.filter((d) => {
                const seen = views.find((v: any) => v.detail === DOCUMENT_LABELS[d.kind]);
                return !seen || new Date(seen.at) < new Date(d.uploaded_at);
            });
            if (unopened.length) {
                return res.status(409).json({ message: `Open the ${unopened.map((d) => DOCUMENT_LABELS[d.kind]).join(' and ')} before approving.` });
            }
            const updated = await query(
                `UPDATE hospitals SET is_verified = TRUE, verification_status = 'verified', verified_at = now(), verified_by = $2, verification_note = NULL
                 WHERE user_id = $1 AND verification_status = 'pending'`,
                [hospitalId, adminId]
            );
            if (!updated.rowCount) return res.status(409).json({ message: 'This hospital changed its verification just now. Reload and try again.' });
            await log(hospitalId, adminId, 'approved', null, body.checks);
            decision = 'approved';
        } else if (body.action === 'request_changes') {
            if (h.verification_status !== 'pending') {
                return res.status(409).json({ message: 'Only a hospital waiting for review can be sent back for changes.' });
            }
            await query(
                `UPDATE hospitals SET is_verified = FALSE, verification_status = 'changes_requested', verification_note = $2 WHERE user_id = $1`,
                [hospitalId, body.note]
            );
            await log(hospitalId, adminId, 'changes_requested', body.note);
            decision = 'changes_requested';
        } else {
            if (h.verification_status !== 'verified') return res.status(409).json({ message: 'Only a verified hospital can have its verification revoked.' });
            await query(
                `UPDATE hospitals SET is_verified = FALSE, verification_status = 'changes_requested', verification_note = $2,
                     verified_at = NULL, verified_by = NULL
                 WHERE user_id = $1`,
                [hospitalId, body.note]
            );
            await log(hospitalId, adminId, 'revoked', body.note);
            decision = 'revoked';
        }

        background(sendAccountEmail({
            type: 'hospital_verification', to: h.email, name: h.hospital_name, decision,
            note: body.note ?? null, url: `${frontendUrl()}/hospital`,
        }).catch((err: any) => console.error('Verification email failed:', err.message)));

        const refreshed = await query(
            `SELECT h.user_id AS id, h.hospital_name, COALESCE(h.is_verified, FALSE) AS is_verified, ${reviewColumns}
             FROM hospitals h WHERE h.user_id = $1`,
            [hospitalId]
        );
        res.json(toReview(refreshed.rows[0]));
    } catch (err) {
        serverError(res, err);
    }
};
