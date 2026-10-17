import { test, mock, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import app from '../src/app';
import * as network from '../src/services/donorNetwork';
import { NetworkError } from '../src/services/donorNetwork';
import {
    MAX_DOCUMENT_BYTES, checkDocument, documentsDigest, pdfHasActiveContent, sendDocument, sniffType,
} from '../src/utils/documents';
import { decideHospitalVerification, submitVerification, uploadVerificationDocument } from '../src/controllers/verificationController';
import { recordLabBloodGroup } from '../src/controllers/hospitalController';
import { hospitalVerificationSchema, labBloodGroupSchema, verificationSubmissionSchema } from '../src/schemas/verificationSchemas';

process.env.JWT_SECRET ??= 'test-jwt-secret';

afterEach(() => mock.restoreAll());

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24)]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(12)]);
const HTML = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

/** Answers queries by the first matching SQL fragment and records every call. */
const fakeDb = (answers: [string, any[]][]) => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        calls.push({ sql, params });
        const hit = answers.find(([fragment]) => sql.includes(fragment));
        return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
    });
    return calls;
};

const failure = (check: ReturnType<typeof checkDocument>) => (check.ok ? null : check.status);

// ── What may be uploaded ──────────────────────────────────────────────────

test('only PDF, JPG, PNG and WebP files are accepted, judged by their bytes and not their claimed type', () => {
    assert.equal(sniffType(PDF), 'application/pdf');
    assert.equal(sniffType(JPEG), 'image/jpeg');
    assert.equal(sniffType(PNG), 'image/png');
    assert.equal(sniffType(WEBP), 'image/webp');
    for (const file of [HTML, SVG, Buffer.from('MZ\x90\x00\x03'), Buffer.from('PK\x03\x04')]) assert.equal(sniffType(file), null);

    assert.equal(checkDocument(PNG, 'image/png').ok, true);
    assert.equal(checkDocument(PDF, 'application/pdf; charset=binary').ok, true);
    // A web page renamed .pdf, or a JPEG sent as PNG, is refused
    assert.equal(failure(checkDocument(HTML, 'application/pdf')), 415);
    assert.equal(failure(checkDocument(SVG, 'image/svg+xml')), 415);
    assert.equal(failure(checkDocument(JPEG, 'image/png')), 415);
    assert.equal(failure(checkDocument(Buffer.alloc(0), 'application/pdf')), 400);
    assert.equal(failure(checkDocument('%PDF-1.7', 'application/pdf')), 400);
    assert.equal(failure(checkDocument(Buffer.concat([PDF, Buffer.alloc(MAX_DOCUMENT_BYTES)]), 'application/pdf')), 413);
});

test('PDFs that run scripts or carry other files are refused, even with escaped names', () => {
    for (const part of ['/OpenAction << /S /JavaScript /JS (app.alert(1)) >>', '/AA << /O << /S /Launch /F (cmd.exe) >> >>',
        '/Names << /EmbeddedFiles 2 0 R >>', '/S /J#61vaScript', '/RichMedia 4 0 R']) {
        const pdf = Buffer.from(`%PDF-1.4\n1 0 obj << ${part} >> endobj\n`);
        assert.equal(pdfHasActiveContent(pdf), true, part);
        assert.equal(failure(checkDocument(pdf, 'application/pdf')), 422, part);
    }
    // Ordinary names that merely start the same way are fine
    assert.equal(pdfHasActiveContent(Buffer.from('%PDF-1.4 /Title (JSON export) /JSONData 1 /Lang (en-IN)')), false);
});

test('a stored document goes out as a download with our own type, no sniffing, no scripts and no caching', () => {
    const res: any = { headers: {}, set(h: Record<string, string>) { Object.assign(this.headers, h); return this; }, send(b: Buffer) { this.body = b; return this; } };
    sendDocument(res, 12, { kind: 'registration_certificate', content_type: 'application/pdf', data: PDF });
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(res.headers['Content-Disposition'], 'attachment; filename="registration-certificate-12.pdf"');
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(res.headers['Content-Security-Policy'], "default-src 'none'; sandbox");
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.body, PDF);
});

test('the documents fingerprint ignores order and changes when any file changes', () => {
    const a = { kind: 'registration_certificate', sha256: 'a'.repeat(64) };
    const b = { kind: 'authorisation_letter', sha256: 'b'.repeat(64) };
    assert.equal(documentsDigest([a, b]), documentsDigest([b, a]));
    assert.notEqual(documentsDigest([a, b]), documentsDigest([a, { ...b, sha256: 'c'.repeat(64) }]));
    assert.match(documentsDigest([]), /^[0-9a-f]{64}$/);
});

// ── The hospital's side ───────────────────────────────────────────────────

const hospitalReq = (over: Record<string, unknown> = {}) => ({
    user: { id: 7, role: 'hospital' }, params: { kind: 'registration_certificate' }, body: PNG, get: () => 'image/png', ...over,
} as any);

test('a hospital uploads a document, and once verified its documents are locked', async () => {
    let calls = fakeDb([['INSERT INTO hospital_documents', [{ kind: 'registration_certificate', content_type: 'image/png', size_bytes: PNG.length, uploaded_at: '2026-10-17T06:00:00Z' }]]]);
    let res = fakeRes();
    await uploadVerificationDocument(hospitalReq(), res);
    assert.equal(res.statusCode, 201);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO hospital_documents'))!;
    assert.deepEqual(insert.params.slice(0, 4), [7, 'registration_certificate', 'image/png', PNG.length]);
    assert.match(insert.sql, /verification_status <> 'verified'/, 'the insert itself refuses a verified hospital');
    assert.ok(calls.some((c) => c.sql.includes('INSERT INTO hospital_verification_log') && c.params[2] === 'uploaded'));

    // Verified: nothing is stored
    mock.restoreAll();
    fakeDb([['SELECT 1 FROM hospitals', [{ exists: 1 }]]]);
    res = fakeRes();
    await uploadVerificationDocument(hospitalReq(), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /locked/);

    // An unknown kind, or a file that is not what it claims, never reaches the database
    mock.restoreAll();
    calls = fakeDb([]);
    res = fakeRes();
    await uploadVerificationDocument(hospitalReq({ params: { kind: 'aadhaar_card' } }), res);
    assert.equal(res.statusCode, 404);
    res = fakeRes();
    await uploadVerificationDocument(hospitalReq({ body: HTML, get: () => 'application/pdf' }), res);
    assert.equal(res.statusCode, 415);
    assert.equal(calls.length, 0);
});

const details = {
    registration_number: 'PB/CEA/2024/1234', registration_authority: 'District Registering Authority, Jalandhar', hfr_id: '',
    blood_centre_licence: '', authorised_person: 'Dr Meena Gill', authorised_designation: 'Medical Superintendent', declaration: true,
};
const certificate = { kind: 'registration_certificate', content_type: 'application/pdf', size_bytes: 900, uploaded_at: '2026-10-17T05:00:00Z', sha256: 'a'.repeat(64) };
const letter = { kind: 'authorisation_letter', content_type: 'image/jpeg', size_bytes: 700, uploaded_at: '2026-10-17T05:01:00Z', sha256: 'b'.repeat(64) };

test('the verification form needs the registration details and the declaration', () => {
    const parsed = verificationSubmissionSchema.safeParse({ ...details, hfr_id: 'in0310000123' });
    assert.ok(parsed.success);
    assert.equal(parsed.data.hfr_id, 'IN0310000123');
    assert.equal(verificationSubmissionSchema.safeParse({ ...details, declaration: false }).success, false);
    assert.equal(verificationSubmissionSchema.safeParse({ ...details, hfr_id: 'IN-12' }).success, false);
    assert.equal(verificationSubmissionSchema.safeParse({ ...details, registration_authority: ' ' }).success, false);
    assert.equal(verificationSubmissionSchema.safeParse({ ...details, authorised_person: '' }).success, false);
});

test('a hospital can send its verification for review only with both required documents', async () => {
    const withDocs = (documents: unknown[]) => fakeDb([
        ['FROM hospitals h WHERE h.user_id', [{ verification_status: 'not_submitted', documents }]],
        ['UPDATE hospitals SET registration_number', [{}]],
    ]);
    let calls = withDocs([certificate]);
    let res = fakeRes();
    await submitVerification({ user: { id: 7 }, body: details } as any, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Upload your authorisation letter first.');
    assert.ok(!calls.some((c) => c.sql.includes('UPDATE hospitals')));

    // A licence number needs the licence itself
    mock.restoreAll();
    withDocs([certificate, letter]);
    res = fakeRes();
    await submitVerification({ user: { id: 7 }, body: { ...details, blood_centre_licence: 'PB/BB/2023/45' } } as any, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /blood centre licence/);

    mock.restoreAll();
    calls = withDocs([letter, certificate]);
    res = fakeRes();
    await submitVerification({ user: { id: 7 }, body: details } as any, res);
    assert.equal(res.statusCode, 200);
    const update = calls.find((c) => c.sql.includes("verification_status = 'pending'"))!;
    assert.deepEqual(update.params, [7, 'PB/CEA/2024/1234', 'District Registering Authority, Jalandhar', '', '', 'Dr Meena Gill', 'Medical Superintendent']);
    assert.ok(calls.some((c) => c.sql.includes('INSERT INTO hospital_verification_log') && c.params[2] === 'submitted'));
    assert.equal(res.body.documents.length, 2);
    assert.equal(res.body.documents[0].sha256, undefined, 'fingerprints stay on the server');
});

// ── The admin's side ──────────────────────────────────────────────────────

const national = { userId: 3, isNational: true, state: null, cities: [] };
const documents = [letter, certificate];
const hospitalRow = (status: string) => ({ user_id: 7, hospital_name: 'Civil Hospital', verification_status: status, email: 'civil@example.com', documents });
const approve = { action: 'approve', checks: { documents_match: true, phone_confirmed: true }, documents_digest: documentsDigest(documents) };
const decide = async (body: unknown) => {
    const res = fakeRes();
    await decideHospitalVerification({ params: { id: '7' }, body, adminScope: national } as any, res);
    return res;
};

test('an admin decision needs both checks to approve, and a note to send a hospital back', () => {
    assert.ok(hospitalVerificationSchema.safeParse(approve).success);
    assert.equal(hospitalVerificationSchema.safeParse({ ...approve, checks: { documents_match: true, phone_confirmed: false } }).success, false);
    assert.equal(hospitalVerificationSchema.safeParse({ action: 'approve', documents_digest: approve.documents_digest }).success, false);
    assert.equal(hospitalVerificationSchema.safeParse({ ...approve, documents_digest: 'not-a-digest' }).success, false);
    assert.equal(hospitalVerificationSchema.safeParse({ action: 'request_changes', note: 'fix it' }).success, false);
    assert.ok(hospitalVerificationSchema.safeParse({ action: 'revoke', note: 'The licence expired in September.' }).success);
    assert.equal(hospitalVerificationSchema.safeParse({ verified: true }).success, false, 'the old one-click switch is gone');
});

test('an admin approves only a hospital waiting for review, and only the documents they opened', async () => {
    const email = mock.method(network, 'sendAccountEmail', async () => { });
    fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('not_submitted')]]]);
    assert.equal((await decide(approve)).statusCode, 409, 'nothing sent for review yet');

    mock.restoreAll();
    fakeDb([['FROM hospitals h JOIN users u', [{ ...hospitalRow('pending'), documents: [certificate] }]]]);
    assert.equal((await decide(approve)).statusCode, 409, 'a required document is missing');

    mock.restoreAll();
    fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('pending')]]]);
    const swapped = await decide({ ...approve, documents_digest: 'c'.repeat(64) });
    assert.equal(swapped.statusCode, 409);
    assert.match(swapped.body.message, /changed its documents/);

    // The admin must have opened every document since it was last uploaded
    mock.restoreAll();
    fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('pending')]], ['GROUP BY detail', [{ detail: 'registration certificate', at: '2026-10-17T06:00:00Z' }]]]);
    const unopened = await decide(approve);
    assert.equal(unopened.statusCode, 409);
    assert.equal(unopened.body.message, 'Open the authorisation letter before approving.');
    mock.restoreAll();
    fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('pending')]], ['GROUP BY detail', [
        { detail: 'registration certificate', at: '2026-10-17T06:00:00Z' },
        { detail: 'authorisation letter', at: '2026-10-17T04:00:00Z' }, // before the letter was uploaded (05:01)
    ]]]);
    assert.equal((await decide(approve)).statusCode, 409, 'an older copy was opened');

    mock.restoreAll();
    const sent = mock.method(network, 'sendAccountEmail', async () => { });
    const calls = fakeDb([
        ['FROM hospitals h JOIN users u', [hospitalRow('pending')]],
        ['GROUP BY detail', [{ detail: 'registration certificate', at: '2026-10-17T06:00:00Z' }, { detail: 'authorisation letter', at: '2026-10-17T06:00:00Z' }]],
        ['SET is_verified = TRUE', [{}]],
        ['FROM hospitals h WHERE h.user_id', [{ id: 7, hospital_name: 'Civil Hospital', is_verified: true, verification_status: 'verified', verified_at: '2026-10-17T06:00:00Z', documents, history: [] }]],
    ]);
    const res = await decide(approve);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.is_verified, true);
    assert.equal(res.body.documents_digest, approve.documents_digest);
    assert.equal(res.body.documents[0].sha256, undefined);
    assert.deepEqual(calls.find((c) => c.sql.includes('SET is_verified = TRUE'))!.params, [7, 3]);
    const logged = calls.find((c) => c.sql.includes('INSERT INTO hospital_verification_log'))!;
    assert.deepEqual(logged.params.slice(0, 3), [7, 3, 'approved']);
    assert.deepEqual(JSON.parse(logged.params[4]), approve.checks);
    assert.equal(sent.mock.calls[0]!.arguments[0].decision, 'approved');
    assert.equal(email.mock.callCount(), 0);
});

test('an admin sends a waiting hospital back with a note, and revokes only a verified one', async () => {
    const note = 'The certificate shows a different address. Please upload the current one.';
    mock.method(network, 'sendAccountEmail', async () => { });
    fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('pending')]]]);
    assert.equal((await decide({ action: 'revoke', note })).statusCode, 409);

    mock.restoreAll();
    const sent = mock.method(network, 'sendAccountEmail', async () => { });
    let calls = fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('pending')]], ['FROM hospitals h WHERE h.user_id', [{ id: 7, documents, history: [] }]]]);
    assert.equal((await decide({ action: 'request_changes', note })).statusCode, 200);
    assert.deepEqual(calls.find((c) => c.sql.includes("verification_status = 'changes_requested'"))!.params, [7, note]);
    assert.equal(sent.mock.calls[0]!.arguments[0].note, note);

    mock.restoreAll();
    mock.method(network, 'sendAccountEmail', async () => { });
    calls = fakeDb([['FROM hospitals h JOIN users u', [hospitalRow('verified')]], ['FROM hospitals h WHERE h.user_id', [{ id: 7, documents, history: [] }]]]);
    assert.equal((await decide({ action: 'revoke', note })).statusCode, 200);
    const revoked = calls.find((c) => c.sql.includes('is_verified = FALSE'))!;
    assert.match(revoked.sql, /verified_at = NULL/);
    assert.ok(calls.some((c) => c.sql.includes('INSERT INTO hospital_verification_log') && c.params[2] === 'revoked'));
});

// ── Over HTTP ─────────────────────────────────────────────────────────────

let server: Server;
let base = '';
before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
// Close the server and the pool so the test process exits by itself (a forced
// exit with sockets still closing can crash Node on Windows: "UV_HANDLE_CLOSING")
after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await db.pool.end().catch(() => { });
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const SITE = 'https://blood-donation-frontend-delta.vercel.app';
const cookie = (role: string, id: number) => `ll_${role}=${jwt.sign({ id, email: `${role}@example.com`, role }, process.env.JWT_SECRET as string, { expiresIn: '5m' })}`;

test('an upload passes sign-in, the size cap and the type check before any database work', async () => {
    const calls = fakeDb([['INSERT INTO hospital_documents', [{ kind: 'registration_certificate', content_type: 'application/pdf', size_bytes: PDF.length, uploaded_at: '2026-10-17T06:00:00Z' }]]]);
    const put = (body: Buffer, type: string, init: { cookie?: string; origin?: string } = {}) => fetch(`${base}/hospital/verification/documents/registration_certificate`, {
        method: 'PUT',
        headers: { 'User-Agent': UA, 'Content-Type': type, Origin: init.origin ?? SITE, ...(init.cookie ? { Cookie: init.cookie } : {}) },
        body,
    });
    const hospital = cookie('hospital', 7);
    assert.equal((await put(PDF, 'application/pdf')).status, 401, 'no session');
    assert.equal((await put(PDF, 'application/pdf', { cookie: cookie('donor', 8) })).status, 401, 'a donor session is not a hospital session');
    assert.equal((await put(HTML, 'text/html', { cookie: hospital })).status, 415);
    assert.equal((await put(Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x25), 'application/pdf', { cookie: hospital })).status, 413);
    assert.equal((await put(PDF, 'application/pdf', { cookie: hospital, origin: 'https://evil.example' })).status, 403, 'another site cannot upload');
    assert.equal(calls.length, 0);

    const ok = await put(PDF, 'application/pdf', { cookie: hospital });
    assert.equal(ok.status, 201);
    assert.equal(calls.filter((c) => c.sql.includes('INSERT INTO hospital_documents')).length, 1);
    assert.deepEqual(calls.find((c) => c.sql.includes('INSERT INTO hospital_documents'))!.params[5], PDF);
});

test('an admin downloads a document with headers that stop any browser running it', async () => {
    const calls = fakeDb([
        ['FROM users u LEFT JOIN admin_profiles', [{ role: 'admin', is_national: true, state: null, cities: [], active: true }]],
        ['FROM hospital_documents d JOIN hospitals h', [{ kind: 'registration_certificate', content_type: 'application/pdf', data: PDF }]],
    ]);
    const res = await fetch(`${base}/admin/hospitals/7/documents/registration_certificate`, { headers: { Cookie: cookie('admin', 3), 'User-Agent': UA, Origin: SITE } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="registration-certificate-7.pdf"');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('content-security-policy'), "default-src 'none'; sandbox");
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.equal(res.headers.get('access-control-allow-origin'), SITE, 'the website reads it with fetch');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PDF);
    const viewed = calls.find((c) => c.sql.includes('INSERT INTO hospital_verification_log'));
    assert.deepEqual(viewed?.params.slice(0, 4), [7, 3, 'viewed', 'registration certificate'], 'who opened it is logged');

    const unknown = await fetch(`${base}/admin/hospitals/7/documents/passport`, { headers: { Cookie: cookie('admin', 3), 'User-Agent': UA } });
    assert.equal(unknown.status, 404);
});

// ── Lab-confirmed blood groups ────────────────────────────────────────────

const TOKEN = '410dcab5-0440-4787-a556-2d1a72651973';
const labReq = () => ({ user: { id: 7, role: 'hospital' }, params: { id: '5', matchId: '10011' }, body: { blood_group: 'A+' } } as any);
const saved = { match_id: 10011, lab_blood_group: 'A+', previous_blood_group: 'B+', changed: true, donor_user_id: 41, donor_name: 'Rohan', hospital_name: 'Civil Hospital' };

test('only a verified hospital records a lab result, and only on its own request', async () => {
    assert.equal(labBloodGroupSchema.safeParse({ blood_group: 'A+' }).success, true);
    assert.equal(labBloodGroupSchema.safeParse({ blood_group: 'A' }).success, false);

    let record = mock.method(network, 'recordLabResult', async () => saved);
    fakeDb([['FROM hospitals WHERE user_id', [{ hospital_name: 'Civil Hospital', is_verified: false }]]]);
    let res = fakeRes();
    await recordLabBloodGroup(labReq(), res);
    assert.equal(res.statusCode, 403);

    mock.restoreAll();
    record = mock.method(network, 'recordLabResult', async () => saved);
    fakeDb([['FROM hospitals WHERE user_id', [{ hospital_name: 'Civil Hospital', is_verified: true }]]]);
    res = fakeRes();
    await recordLabBloodGroup(labReq(), res);
    assert.equal(res.statusCode, 404, 'not this hospital\'s request');
    assert.equal(record.mock.callCount(), 0);

    // The network refuses a donation that is not done yet
    mock.restoreAll();
    mock.method(network, 'recordLabResult', async () => { throw new NetworkError('Mark the donation as done first, then record the lab result.', 409); });
    fakeDb([['FROM hospitals WHERE user_id', [{ hospital_name: 'Civil Hospital', is_verified: true }]], ['FROM blood_requests', [{ network_request_id: 1042, hospital_token: TOKEN }]]]);
    res = fakeRes();
    await recordLabBloodGroup(labReq(), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /donation as done first/);
});

test('a lab result reaches the network with the hospital token, and a corrected donor is emailed', async () => {
    const record = mock.method(network, 'recordLabResult', async () => saved);
    const email = mock.method(network, 'sendAccountEmail', async () => { });
    fakeDb([
        ['FROM hospitals WHERE user_id', [{ hospital_name: 'Civil Hospital', is_verified: true }]],
        ['FROM blood_requests', [{ network_request_id: 1042, hospital_token: TOKEN }]],
        ['FROM users WHERE id', [{ name: 'Rohan Mehta', email: 'rohan@example.com' }]],
    ]);
    const res = fakeRes();
    await recordLabBloodGroup(labReq(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { match_id: 10011, lab_blood_group: 'A+', previous_blood_group: 'B+', changed: true });
    assert.deepEqual(record.mock.calls[0]!.arguments[0], { request_id: 1042, hospital_token: TOKEN, match_id: 10011, blood_group: 'A+', recorded_by: 7 });
    assert.deepEqual(email.mock.calls[0]!.arguments[0], {
        type: 'blood_group_corrected', to: 'rohan@example.com', name: 'Rohan Mehta', blood_group: 'A+', previous_blood_group: 'B+', hospital_name: 'Civil Hospital',
    });

    // A confirmation of the same group sends no email
    mock.restoreAll();
    mock.method(network, 'recordLabResult', async () => ({ ...saved, lab_blood_group: 'B+', changed: false }));
    const quiet = mock.method(network, 'sendAccountEmail', async () => { });
    fakeDb([['FROM hospitals WHERE user_id', [{ hospital_name: 'Civil Hospital', is_verified: true }]], ['FROM blood_requests', [{ network_request_id: 1042, hospital_token: TOKEN }]]]);
    await recordLabBloodGroup({ ...labReq(), body: { blood_group: 'B+' } }, fakeRes());
    assert.equal(quiet.mock.callCount(), 0);
});
