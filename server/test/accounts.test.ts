import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import * as engine from '../src/network/engine';
import * as network from '../src/services/donorNetwork';
import * as keep from '../src/utils/keepSignedIn';
import { LEGAL_VERSION, ageOn, donorAgeProblem } from '../src/utils/legal';
import { registerSchema } from '../src/schemas/authSchemas';
import { donorProfileSchema, certificateRequestSchema } from '../src/schemas/donorSchemas';
import { hospitalProfileSchema } from '../src/schemas/hospitalSchemas';
import { userActiveSchema } from '../src/schemas/adminSchemas';
import { login, register } from '../src/controllers/authController';
import { BLOOD_GROUP_LOCKED, updateDonorProfile } from '../src/controllers/donorController';
import { updateHospitalProfile } from '../src/controllers/hospitalController';
import { deleteAccount } from '../src/controllers/userController';
import { setUserActive } from '../src/controllers/adminController';
import { CERTIFICATE_CODE, issueCertificate, newCertificateCode, shortName, verifyCertificate } from '../src/controllers/certificateController';
import { PostgresStore, sharedLimitsEnabled } from '../src/middleware/rateLimitStore';
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import adminRoutes from '../src/routes/adminRoutes';
import jwt from 'jsonwebtoken';
import { authMiddleware, forgetAccountCheck } from '../src/middleware/authMiddleware';
import userRoutes from '../src/routes/userRoutes';

afterEach(() => mock.restoreAll());

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
/** A pool client for code that runs its own transaction. */
const fakeClient = (answers: [string, any[]][] = []) => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db.default, 'connect', async () => ({
        query: async (sql: string, params: any[] = []) => {
            calls.push({ sql, params });
            const hit = answers.find(([fragment]) => sql.includes(fragment));
            return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
        },
        release: () => { },
    }));
    return calls;
};

// ── Age and consent ───────────────────────────────────────────────────────

test('donors must be 18 to 65 on the day, counted in India time', () => {
    // 2026-10-18 03:00 IST is still 2026-10-17 in UTC
    const now = new Date('2026-10-17T21:30:00Z');
    assert.equal(ageOn('2008-10-18', now), 18, 'an 18th birthday in India counts the same morning');
    assert.equal(donorAgeProblem('2008-10-18', now), null);
    assert.match(donorAgeProblem('2008-10-19', now)!, /at least 18/);
    assert.equal(donorAgeProblem('1961-10-18', now), null, '65 is still fine');
    assert.match(donorAgeProblem('1960-10-17', now)!, /at most 65/);
    assert.match(donorAgeProblem('2026-02-30', now)!, /real date/);
    assert.match(donorAgeProblem('2030-01-01', now)!, /real date|at least 18/);
    assert.match(donorAgeProblem('', now)!, /date of birth/);
    assert.match(donorAgeProblem(undefined, now)!, /date of birth/);
});

test('the consent version matches the date on the Terms and Privacy Policy', () => {
    const contact = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'contact.ts'), 'utf8');
    const shown = /LEGAL_UPDATED = '(\d{1,2}) (\w+) (\d{4})'/.exec(contact);
    assert.ok(shown, 'LEGAL_UPDATED found');
    const month = new Date(`${shown![2]} 1, 2000`).getMonth() + 1;
    assert.equal(`${shown![3]}-${String(month).padStart(2, '0')}-${shown![1]!.padStart(2, '0')}`, LEGAL_VERSION);
});

test('signing up needs the Terms accepted, and donors a real date of birth within 18 to 65', () => {
    const donor = { name: 'Kavya Sood', email: 'kavya@example.com', password: 'Str0ng*Pass', role: 'donor', blood_group: 'B+', city: 'Pune', phone: '9876543210', dob: '1995-05-05' };
    assert.equal(registerSchema.safeParse(donor).success, false, 'no acceptance');
    assert.equal(registerSchema.safeParse({ ...donor, accept_terms: false }).success, false);
    assert.ok(registerSchema.safeParse({ ...donor, accept_terms: true }).success);
    const minor = registerSchema.safeParse({ ...donor, accept_terms: true, dob: '2015-01-01' });
    assert.equal(minor.success, false);
    assert.match(minor.error!.issues[0]!.message, /at least 18/);
    assert.equal(registerSchema.safeParse({ ...donor, accept_terms: true, dob: undefined }).success, false);
    // Hospitals have no date of birth
    const hospital = { name: 'Civil Hospital', email: 'civil@example.com', password: 'Str0ng*Pass', role: 'hospital', hospital_name: 'Civil Hospital', city: 'Pune', contact_number: '02012345678', registration_number: 'MH-1', accept_terms: true };
    assert.ok(registerSchema.safeParse(hospital).success);
});

test('a new account records the version of the Terms it accepted', async () => {
    mock.method(network, 'enrolDonor', async () => { });
    mock.method(keep, 'startKeptSession', async () => ({ value: 'kept', session: {} }));
    const calls = fakeDb([['INSERT INTO users', [{ id: 41, name: 'Kavya Sood', email: 'kavya@example.com', role: 'donor' }]]]);
    const res = fakeRes();
    await register({
        body: { name: 'Kavya Sood', email: 'kavya@example.com', password: 'Str0ng*Pass', role: 'donor', blood_group: 'B+', city: 'Pune', phone: '9876543210', dob: '1995-05-05', gender: 'female', accept_terms: true },
        headers: {}, cookies: {},
    } as any, res);
    assert.equal(res.statusCode, 201);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO users'))!;
    assert.match(insert.sql, /consent_version, consented_at/);
    assert.equal(insert.params[4], LEGAL_VERSION);
});

test('a deactivated account cannot sign in, even with the right password', async () => {
    const hash = await bcrypt.hash('Str0ng*Pass', 4);
    fakeDb([['SELECT * FROM users WHERE email', [{ id: 41, name: 'Kavya', email: 'kavya@example.com', role: 'donor', password_hash: hash, disabled_at: new Date() }]]]);
    const res = fakeRes();
    await login({ body: { email: 'kavya@example.com', password: 'Str0ng*Pass' }, ip: '203.0.113.9', headers: {}, cookies: {} } as any, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'account_deactivated');
    assert.equal(Object.keys(res.cookies).length, 0, 'no session');
});

// ── Profiles ──────────────────────────────────────────────────────────────

const donorReq = (body: unknown) => ({ user: { id: 41, role: 'donor' }, body } as any);
const profileRow = (over: Record<string, unknown> = {}) => ({
    name: 'Kavya Sood', email: 'kavya@example.com', phone: '+919876543210', city: 'Pune', gender: 'female', dob: '1995-05-05',
    blood_group: 'B+', entry_id: 7, blood_group_verified: false, ...over,
});

test('profile edits are checked: a lab-confirmed group is locked, and a phone stays with one account', async () => {
    assert.equal(donorProfileSchema.safeParse({}).success, false, 'nothing to change');
    assert.equal(donorProfileSchema.safeParse({ dob: '2015-01-01' }).success, false);
    assert.ok(donorProfileSchema.safeParse({ city: 'Mumbai' }).success);

    fakeDb([['FROM users u JOIN donors d', [profileRow({ blood_group_verified: true })]]]);
    let res = fakeRes();
    await updateDonorProfile(donorReq({ blood_group: 'A+' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, BLOOD_GROUP_LOCKED);

    mock.restoreAll();
    fakeDb([['FROM users u JOIN donors d', [profileRow()]], ['SELECT user_id FROM network_donors WHERE phone', [{ user_id: 99 }]]]);
    res = fakeRes();
    await updateDonorProfile(donorReq({ phone: '98765 00000' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, engine.PHONE_TAKEN);

    mock.restoreAll();
    fakeDb([['FROM users u JOIN donors d', [profileRow()]], ['SELECT user_id FROM network_donors WHERE phone', [{ user_id: null }]]]);
    res = fakeRes();
    await updateDonorProfile(donorReq({ phone: '98765 00000' }), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /SMS or USSD/);
});

test('a new phone moves the network entry, history and all, and a new city drops the old location', async () => {
    fakeDb([['FROM users u JOIN donors d', [profileRow()]]]);
    const tx = fakeClient();
    const res = fakeRes();
    await updateDonorProfile(donorReq({ phone: '98765 00000', city: 'Mumbai' }), res);
    assert.equal(res.statusCode, 200);
    const donors = tx.find((c) => c.sql.includes('UPDATE donors'))!;
    assert.deepEqual([donors.params[1], donors.params[2], donors.params[6]], ['+919876500000', 'Mumbai', true]);
    const entry = tx.find((c) => c.sql.includes('UPDATE network_donors'))!;
    assert.equal(entry.params[0], 7, 'the existing entry, not a new one');
    assert.equal(entry.params[2], '+919876500000');
    assert.match(entry.sql, /blood_group_verified_at IS NULL THEN COALESCE/);
    assert.deepEqual(tx.map((c) => c.sql.trim().split(/\s/)[0]), ['BEGIN', 'UPDATE', 'UPDATE', 'COMMIT']);
});

test('a verified hospital can change its phone and location, but not the details an admin checked', async () => {
    assert.equal(hospitalProfileSchema.safeParse({ latitude: 18.5 }).success, false, 'both coordinates');
    const parsed = hospitalProfileSchema.safeParse({ contact_number: '020 1234 5678' });
    assert.ok(parsed.success);
    assert.equal(parsed.data.contact_number, '02012345678');

    const hospital = { hospital_name: 'Civil Hospital', verification_status: 'verified', is_verified: true };
    fakeDb([['FROM hospitals WHERE user_id', [hospital]]]);
    let res = fakeRes();
    await updateHospitalProfile({ user: { id: 7 }, body: { address: '1 New Road, Pune' } } as any, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /locked/);

    mock.restoreAll();
    const calls = fakeDb([['FROM hospitals WHERE user_id', [hospital]]]);
    res = fakeRes();
    await updateHospitalProfile({ user: { id: 7 }, body: { contact_number: '02012345678', latitude: 18.52, longitude: 73.85 } } as any, res);
    assert.equal(res.statusCode, 200);
    const update = calls.find((c) => c.sql.startsWith('UPDATE hospitals'))!;
    assert.equal(update.sql, 'UPDATE hospitals SET contact_number = $2, latitude = $3, longitude = $4 WHERE user_id = $1');
    assert.deepEqual(update.params, [7, '02012345678', 18.52, 73.85]);
});

// ── Deleting and deactivating accounts ────────────────────────────────────

test('a donor deletes their account: requests are handed on first, then their data goes', async () => {
    const hash = await bcrypt.hash('Str0ng*Pass', 4);
    const account = { id: 41, role: 'donor', email: 'Kavya@Example.com', password_hash: hash, phone: '98765 43210' };

    fakeDb([['FROM users u LEFT JOIN donors', [{ ...account, role: 'hospital' }]]]);
    let res = fakeRes();
    await deleteAccount(donorReq({ password: 'Str0ng*Pass' }), res);
    assert.equal(res.statusCode, 403, 'hospitals close their account through LifeLink');

    mock.restoreAll();
    fakeDb([['FROM users u LEFT JOIN donors', [account]]]);
    res = fakeRes();
    await deleteAccount(donorReq({ password: 'wrong' }), res);
    assert.equal(res.statusCode, 403, 'not 401, which would end the session on the website');
    assert.equal(res.body.error, 'wrong_password');

    mock.restoreAll();
    fakeDb([
        ['FROM users u LEFT JOIN donors', [account]],
        ['FROM network_donors WHERE user_id', [{ id: 7, phone: '+919876543210' }]],
        ['FROM network_matches WHERE donor_id', [{ id: 10011, response_token: 'tok-1' }]],
    ]);
    const declined = mock.method(engine, 'respond', async () => ({ outcome: 'withdrawn' }));
    const tx = fakeClient();
    res = fakeRes();
    await deleteAccount({ ...donorReq({ password: 'Str0ng*Pass' }), cookies: {}, headers: {}, header: () => undefined, get: () => undefined } as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(declined.mock.calls[0]!.arguments[0], { m: '10011', t: 'tok-1', a: 'decline', format: 'json' });
    const sql = tx.map((c) => c.sql);
    assert.ok(sql.some((s) => s.includes('UPDATE network_matches SET contact = NULL')), 'contact scrubbed from request history');
    const outbox = tx.find((c) => c.sql.includes('DELETE FROM network_outbox'))!;
    assert.deepEqual(outbox.params[0], ['+919876543210', '98765 43210', 'kavya@example.com']);
    assert.ok(sql.some((s) => s.includes('DELETE FROM campaign_registrations')));
    assert.ok(sql.some((s) => s.includes('DELETE FROM users WHERE id = $1')));
    assert.equal(sql.at(-1), 'COMMIT');
    assert.ok(res.cleared.includes('ll_donor') && res.cleared.includes('ll_donor_keep'), 'signed out');
});

test('an admin deactivates a donor or hospital in their area only, with a reason; sign-ins and open requests end', async () => {
    assert.equal(userActiveSchema.safeParse({ active: false }).success, false, 'a reason is needed');
    assert.ok(userActiveSchema.safeParse({ active: false, reason: 'Fake requests' }).success);
    assert.ok(userActiveSchema.safeParse({ active: true }).success);

    const pune = { userId: 5, isNational: false, state: 'Maharashtra', cities: ['pune'] };
    fakeDb([['SELECT id, role FROM users', [{ id: 41, role: 'donor' }]]]);
    let res = fakeRes();
    await setUserActive({ params: { id: '41' }, body: { active: false, reason: 'Fake requests' }, adminScope: pune } as any, res);
    assert.equal(res.statusCode, 404, 'a donor outside Pune');

    mock.restoreAll();
    const ended = mock.method(keep, 'endAllKeptSessions', async () => { });
    const calls = fakeDb([['SELECT id, role FROM users', [{ id: 41, role: 'donor' }]], ['FROM donors d WHERE d.user_id', [{ '?column?': 1 }]]]);
    res = fakeRes();
    await setUserActive({ params: { id: '41' }, body: { active: false, reason: 'Fake requests' }, adminScope: pune } as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls.find((c) => c.sql.includes('SET disabled_at = now()'))!.params, [41, 'Fake requests', 5]);
    assert.equal(ended.mock.calls[0]!.arguments[0], 41);
    assert.ok(calls.some((c) => c.sql.includes('UPDATE network_donors SET available = FALSE')));

    mock.restoreAll();
    const back = fakeDb([['SELECT id, role FROM users', [{ id: 41, role: 'donor' }]], ['FROM donors d WHERE d.user_id', [{ '?column?': 1 }]]]);
    res = fakeRes();
    await setUserActive({ params: { id: '41' }, body: { active: true }, adminScope: pune } as any, res);
    assert.ok(back.some((c) => c.sql.includes('SET disabled_at = NULL')));

    mock.restoreAll();
    mock.method(keep, 'endAllKeptSessions', async () => { });
    const cancelled = mock.method(engine, 'respond', async () => ({ outcome: 'cancelled' }));
    fakeDb([
        ['SELECT id, role FROM users', [{ id: 7, role: 'hospital' }]],
        ['FROM hospitals h WHERE h.user_id', [{ '?column?': 1 }]],
        ['FROM blood_requests br JOIN network_requests nr', [{ id: 55, hospital_token: 'h-tok' }]],
    ]);
    res = fakeRes();
    await setUserActive({ params: { id: '7' }, body: { active: false, reason: 'Fake requests' }, adminScope: pune } as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(cancelled.mock.calls[0]!.arguments[0], { r: '55', h: 'h-tok', a: 'cancel', format: 'json' }, 'its open requests are cancelled');

    mock.restoreAll();
    fakeDb([['SELECT id, role FROM users', [{ id: 3, role: 'admin' }]]]);
    res = fakeRes();
    await setUserActive({ params: { id: '3' }, body: { active: false, reason: 'Testing' }, adminScope: { ...pune, isNational: true } } as any, res);
    assert.equal(res.statusCode, 404, 'admins are managed elsewhere');
});

test('a deactivated or deleted account loses access at once, not when its 30-minute session ends', async () => {
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    const token = jwt.sign({ id: 41, email: 'kavya@example.com', role: 'donor' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '30m' });
    const req = () => ({ cookies: { ll_donor: token }, headers: {}, header: () => undefined, baseUrl: '/donor', path: '/profile' } as any);
    const run = async () => {
        const res = fakeRes();
        let passed = false;
        await authMiddleware(req(), res, () => { passed = true; });
        return { res, passed };
    };

    let calls = fakeDb([['SELECT disabled_at FROM users', [{ disabled_at: null }]]]);
    forgetAccountCheck(41);
    assert.equal((await run()).passed, true);
    assert.equal((await run()).passed, true);
    assert.equal(calls.length, 1, 'checked once, then remembered for a few seconds');

    mock.restoreAll();
    fakeDb([['SELECT disabled_at FROM users', [{ disabled_at: new Date() }]]]);
    forgetAccountCheck(41); // what deactivating does
    let out = await run();
    assert.equal(out.passed, false);
    assert.equal(out.res.statusCode, 401);
    assert.equal(out.res.body.error, 'account_closed');

    mock.restoreAll();
    fakeDb([]);
    forgetAccountCheck(41); // deleted: no row
    assert.equal((await run()).res.statusCode, 401);

    mock.restoreAll();
    mock.method(db, 'query', async () => { throw new Error('connection refused'); });
    forgetAccountCheck(41);
    out = await run();
    assert.equal(out.res.statusCode, 503, 'a database problem is not "signed out"');
    assert.equal(out.passed, false);
});

test('a deactivated account never counts as an available donor', () => {
    const store = fs.readFileSync(path.join(__dirname, '..', 'src', 'network', 'store.ts'), 'utf8');
    assert.match(store, /\(available AND NOT EXISTS \(SELECT 1 FROM users u WHERE u\.id = network_donors\.user_id AND u\.disabled_at IS NOT NULL\)\) AS available/);
});

// ── Certificates ──────────────────────────────────────────────────────────

test('certificate codes are unambiguous and the public check shows only a first name and initial', async () => {
    for (let i = 0; i < 50; i++) assert.match(newCertificateCode(), CERTIFICATE_CODE);
    assert.equal(shortName('Kavya Sood'), 'Kavya S.');
    assert.equal(shortName('Kavya'), 'Kavya');
    assert.equal(shortName('  '), 'LifeLink donor');
    assert.equal(certificateRequestSchema.safeParse({ donation_id: 1, match_id: 2 }).success, false, 'one or the other');

    fakeDb([]);
    let res: any = fakeRes();
    res.set = () => res;
    await verifyCertificate({ params: { code: 'LC-0000-1111' } } as any, res);
    assert.equal(res.statusCode, 404, 'not a code at all');

    mock.restoreAll();
    fakeDb([['FROM donation_certificates WHERE code', [{ code: 'LC-ABCD-EFGH', donor_name: 'Kavya Sood', hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17' }]]]);
    res = fakeRes();
    res.set = () => res;
    await verifyCertificate({ params: { code: 'lc-abcd-efgh' } } as any, res);
    assert.deepEqual(res.body, { valid: true, code: 'LC-ABCD-EFGH', donor: 'Kavya S.', hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17' });
});

test('a donor gets a certificate only for their own donation, and the same one every time', async () => {
    fakeDb([]);
    let res = fakeRes();
    await issueCertificate(donorReq({ match_id: 10011 }), res);
    assert.equal(res.statusCode, 404, 'not this donor\'s donation');

    mock.restoreAll();
    const existing = { code: 'LC-ABCD-EFGH', donor_name: 'Kavya Sood', hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17' };
    let calls = fakeDb([
        ['FROM donations dn JOIN hospitals', [{ donation_id: 3, match_id: 10011, hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17' }]],
        ['FROM donation_certificates', [existing]],
    ]);
    res = fakeRes();
    await issueCertificate(donorReq({ donation_id: 3 }), res);
    assert.equal(res.body.code, 'LC-ABCD-EFGH', 'the network donation already has one');
    assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO donation_certificates')));
    assert.deepEqual(calls.find((c) => c.sql.includes('FROM donation_certificates'))!.params, [41, 10011, 3]);

    mock.restoreAll();
    calls = fakeDb([
        ['FROM network_matches m JOIN network_donors', [{ donation_id: null, match_id: 10011, hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17' }]],
        ['SELECT name FROM users', [{ name: 'Kavya Sood' }]],
        ['INSERT INTO donation_certificates', [{ ...existing, code: 'LC-WXYZ-2345' }]],
    ]);
    res = fakeRes();
    await issueCertificate(donorReq({ match_id: 10011 }), res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body.verify_url, /\/certificate\/LC-WXYZ-2345$/);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO donation_certificates'))!;
    assert.deepEqual(insert.params.slice(1), [41, null, 10011, 'Kavya Sood', 'Civil Hospital', 'Pune', '2026-10-17']);
});

// ── Shared rate limits ────────────────────────────────────────────────────

test('the shared rate-limit store counts in Postgres, per prefix, and is on wherever the API runs on Vercel', async () => {
    assert.equal(sharedLimitsEnabled({}), false);
    assert.equal(sharedLimitsEnabled({ VERCEL: '1' }), true);
    assert.equal(sharedLimitsEnabled({ K_SERVICE: 'lifelink-api' }), true, 'Cloud Run');
    assert.equal(sharedLimitsEnabled({ RATE_LIMIT_STORE: 'postgres' }), true);

    const store = new PostgresStore('login');
    store.init({ windowMs: 15 * 60 * 1000 } as any);
    const reset = new Date('2026-10-18T07:00:00Z');
    const calls = fakeDb([['INSERT INTO rate_limits', [{ hits: 3, reset_at: reset }]]]);
    assert.deepEqual(await store.increment('203.0.113.9'), { totalHits: 3, resetTime: reset });
    assert.deepEqual(calls[0]!.params, ['login:203.0.113.9', 900000]);
    assert.match(calls[0]!.sql, /CASE WHEN rate_limits\.reset_at <= now\(\) THEN 1 ELSE rate_limits\.hits \+ 1 END/);
    await store.decrement('203.0.113.9');
    await store.resetKey('203.0.113.9');
    assert.match(calls[1]!.sql, /GREATEST\(hits - 1, 0\)/);
    assert.deepEqual(calls[2]!.params, ['login:203.0.113.9']);

    mock.restoreAll();
    fakeDb([]);
    await assert.rejects(store.increment('x'), /did not answer/);
});

// ── Routes ────────────────────────────────────────────────────────────────

const routesOf = (router: any): string[] => router.stack.filter((l: any) => l.route)
    .map((l: any) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);

test('the unused admin lists and notifications are gone, and anyone can check a certificate', async () => {
    assert.deepEqual(routesOf(userRoutes), ['DELETE /account']);
    const admin = routesOf(adminRoutes);
    assert.ok(!admin.includes('GET /users') && !admin.includes('GET /donations'), admin.join('; '));
    assert.ok(admin.includes('PUT /users/:id/active'));

    fakeDb([]);
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/certificates/LC-ABCD-EFGH`);
        assert.equal(res.status, 404, 'no sign-in needed, and an unknown code is simply not found');
        assert.deepEqual(await res.json(), { valid: false, message: 'No LifeLink certificate has this code.' });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
