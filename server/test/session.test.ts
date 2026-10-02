import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { requestedRole, sessionToken } from '../src/middleware/session';
import { logout, register } from '../src/controllers/authController';
import { sealSecret } from '../src/utils/mfa';
import { cancelHospitalRequest } from '../src/controllers/hospitalController';
import { forcedBrowsingGuard } from '../src/middleware/securityMiddleware';

afterEach(() => mock.restoreAll());

/** A minimal Express-like request. */
const fakeReq = (opts: { path?: string; baseUrl?: string; cookies?: Record<string, string>; headers?: Record<string, string> }) => ({
    path: opts.path ?? '/',
    baseUrl: opts.baseUrl ?? '',
    cookies: opts.cookies ?? {},
    header: (name: string) => (opts.headers ?? {})[name.toLowerCase()],
}) as any;

const both = { ll_admin: 'admin-jwt', ll_hospital: 'hospital-jwt' };

test('each dashboard uses its own session, even with several accounts signed in', () => {
    assert.equal(sessionToken(fakeReq({ path: '/hospital/requests', cookies: both })), 'hospital-jwt');
    assert.equal(sessionToken(fakeReq({ baseUrl: '/admin', path: '/overview', cookies: both })), 'admin-jwt');
    // The header wins (shared routes like /user and /ai)
    assert.equal(sessionToken(fakeReq({ path: '/user/notifications', cookies: both, headers: { 'x-lifelink-role': 'hospital' } })), 'hospital-jwt');
    // Asking for an account the browser is not signed in to gets no session, not another account's
    assert.equal(sessionToken(fakeReq({ path: '/donor/network', cookies: both })), undefined);
});

test('without a role, only an unambiguous session is used', () => {
    assert.equal(sessionToken(fakeReq({ path: '/user/notifications', cookies: { ll_donor: 'donor-jwt' } })), 'donor-jwt');
    assert.equal(sessionToken(fakeReq({ path: '/user/notifications', cookies: both })), undefined);
    assert.equal(sessionToken(fakeReq({ path: '/user/notifications', cookies: { token: 'old-jwt' } })), 'old-jwt');
    assert.equal(sessionToken(fakeReq({ path: '/user/notifications', headers: { authorization: 'Bearer api-jwt' } })), 'api-jwt');
    assert.equal(requestedRole(fakeReq({ path: '/auth/login' })), null);
    assert.equal(requestedRole(fakeReq({ path: '/auth/logout', headers: { 'x-lifelink-role': 'nurse' } })), null);
});

test('signing out of the hospital keeps the admin signed in', async () => {
    const res = fakeRes();
    await logout(fakeReq({ path: '/auth/logout', cookies: both, headers: { 'x-lifelink-role': 'hospital' } }), res);
    assert.deepEqual(res.cleared, ['ll_hospital', 'll_hospital_keep', 'token']);

    const all = fakeRes();
    await logout(fakeReq({ path: '/auth/logout', cookies: both }), all);
    assert.deepEqual(all.cleared, ['ll_admin', 'll_admin_keep', 'll_hospital', 'll_hospital_keep', 'll_donor', 'll_donor_keep', 'token']);
});

test('a new hospital sets up two-step verification before it gets a session', async () => {
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    mock.method(db, 'query', async (sql: string) => ({
        rows: sql.includes('INSERT INTO users') ? [{ id: 9, name: 'Civil Hospital', email: 'civil@example.com', role: 'hospital' }]
            : sql.includes('INSERT INTO user_mfa') ? [{ secret_enc: sealSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ') }] : [],
    }));
    const res = fakeRes();
    await register({
        body: { role: 'hospital', name: 'Civil Hospital', email: 'civil@example.com', password: 'Str0ng*Pass', hospital_name: 'Civil Hospital', city: 'Jalandhar', contact_number: '+915550000931', registration_number: 'CEA-1' },
    } as any, res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(Object.keys(res.cookies), [], 'no session until the authenticator code is entered');
    assert.equal(res.body.mfa.mode, 'setup');
    assert.equal(res.body.mfa.secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.match(res.body.mfa.otpauth_url, /^otpauth:\/\/totp\/LifeLink%3Acivil%40example\.com\?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=LifeLink/);
});

const hospitalReq = (id: string) => ({ params: { id }, user: { id: 22, role: 'hospital' } }) as any;

test('a request that never reached donors can be cancelled', async () => {
    const calls: string[] = [];
    mock.method(db, 'query', async (sql: string) => {
        calls.push(sql);
        if (sql.startsWith('SELECT id, status')) return { rows: [{ id: 5, status: 'Open', network_request_id: null }] };
        return { rows: [{ id: 5, status: 'Cancelled', hospital_token: 'secret' }] };
    });
    const res = fakeRes();
    await cancelHospitalRequest(hospitalReq('5'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'Cancelled');
    assert.equal(res.body.hospital_token, undefined, 'the control token never reaches the browser');
    assert.match(calls[0]!, /hospital_id = \$2/);
});

test('network requests and closed requests are not cancelled locally', async () => {
    let row: any = { id: 6, status: 'Exhausted', network_request_id: 42 };
    mock.method(db, 'query', async () => ({ rows: row ? [row] : [] }));
    let res = fakeRes();
    await cancelHospitalRequest(hospitalReq('6'), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /stand down/);

    row = { id: 7, status: 'Completed', network_request_id: null };
    res = fakeRes();
    await cancelHospitalRequest(hospitalReq('7'), res);
    assert.equal(res.statusCode, 409);

    row = null;
    res = fakeRes();
    await cancelHospitalRequest(hospitalReq('8'), res);
    assert.equal(res.statusCode, 404);
});

test('the app-wide protected-path guard accepts per-account sessions', () => {
    let passed = false;
    const res = fakeRes();
    forcedBrowsingGuard(fakeReq({ path: '/hospital/profile', cookies: { ll_hospital: 'hospital-jwt' }, headers: { 'x-lifelink-role': 'hospital' } }), res, () => { passed = true; });
    assert.equal(passed, true);

    passed = false;
    const denied = fakeRes();
    forcedBrowsingGuard(fakeReq({ path: '/hospital/profile', cookies: { ll_admin: 'admin-jwt' } }), denied, () => { passed = true; });
    assert.equal(passed, false);
    assert.equal(denied.statusCode, 401);
});
