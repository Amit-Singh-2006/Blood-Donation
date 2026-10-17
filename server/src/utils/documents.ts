/**
 * Hospital verification documents: which ones there are, the checks every
 * upload passes before it is stored, and how a stored file is sent back. A
 * file's type comes from its first bytes, never from its name or from the
 * type the browser claims, and no file is ever served in a way a browser
 * would run.
 */
import { createHash } from 'crypto';
import type { Response } from 'express';

export const DOCUMENT_KINDS = ['registration_certificate', 'authorisation_letter', 'blood_centre_licence'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Without these two a hospital cannot send its verification for review. */
export const REQUIRED_DOCUMENTS: readonly DocumentKind[] = ['registration_certificate', 'authorisation_letter'];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
    registration_certificate: 'registration certificate',
    authorisation_letter: 'authorisation letter',
    blood_centre_licence: 'blood centre licence',
};

export const isDocumentKind = (value: unknown): value is DocumentKind => DOCUMENT_KINDS.includes(value as DocumentKind);

export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

const EXTENSIONS: Record<DocumentType, string> = {
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The file's real type, from its first bytes; null for anything else. */
export const sniffType = (file: Buffer): DocumentType | null => {
    if (file.length >= 5 && file.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
    if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) return 'image/jpeg';
    if (file.length >= 8 && file.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
    if (file.length >= 12 && file.subarray(0, 4).toString('latin1') === 'RIFF' && file.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    return null;
};

// PDF features that run code or carry other files. A name can hide its
// letters as #xx escapes (/J#61vaScript), so those are decoded first.
const ACTIVE_PDF = /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia)(?![A-Za-z0-9])/;

export const pdfHasActiveContent = (file: Buffer): boolean =>
    ACTIVE_PDF.test(file.toString('latin1').replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));

export type DocumentCheck =
    | { ok: true; type: DocumentType; sha256: string }
    | { ok: false; status: number; message: string };

/** Size, real type (which must match what was sent), and no scripts or attachments inside a PDF. */
export const checkDocument = (body: unknown, declaredType: string | undefined): DocumentCheck => {
    if (!Buffer.isBuffer(body) || body.length === 0) return { ok: false, status: 400, message: 'Choose a file to upload.' };
    if (body.length > MAX_DOCUMENT_BYTES) {
        return { ok: false, status: 413, message: 'The file is larger than 3 MB. Upload a smaller scan or photo.' };
    }
    const type = sniffType(body);
    const declared = String(declaredType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!type || declared !== type) return { ok: false, status: 415, message: 'Upload a PDF, JPG, PNG or WebP file.' };
    if (type === 'application/pdf' && pdfHasActiveContent(body)) {
        return { ok: false, status: 422, message: 'This PDF contains scripts or attached files. Upload a scan or a plain PDF instead.' };
    }
    return { ok: true, type, sha256: createHash('sha256').update(body).digest('hex') };
};

/**
 * One fingerprint of all of a hospital's documents. The admin's approval
 * carries the one they reviewed, so a file swapped mid-review is noticed.
 */
export const documentsDigest = (documents: { kind: string; sha256: string }[]): string =>
    createHash('sha256')
        .update([...documents].sort((a, b) => a.kind.localeCompare(b.kind)).map((d) => `${d.kind}:${d.sha256}`).join('\n'))
        .digest('hex');

/** Our own download name, never the uploader's: "registration-certificate-12.pdf". */
export const documentFileName = (kind: DocumentKind, hospitalId: number, type: DocumentType) =>
    `${kind.replace(/_/g, '-')}-${hospitalId}.${EXTENSIONS[type]}`;

/**
 * Sends a stored document as a download with the type we detected: no MIME
 * sniffing, no scripts even if opened directly, no caching, and only to
 * pages on this API's own origin when embedded (the website reads it with
 * fetch, which CORS governs).
 */
export const sendDocument = (res: Response, hospitalId: number, doc: { kind: DocumentKind; content_type: DocumentType; data: Buffer }) => {
    res.set({
        'Content-Type': doc.content_type,
        'Content-Disposition': `attachment; filename="${documentFileName(doc.kind, hospitalId, doc.content_type)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cache-Control': 'private, no-store',
    });
    res.send(doc.data);
};
