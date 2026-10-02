import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { resumeKeptSession, startKeptSession } from '../src/utils/keepSignedIn';
import { login, logout, refreshSession } from '../src/controllers/authController';

process.env.JWT_SECRET ??= 'test-jwt-secret';
afterEach(() => mock.restoreAll());

const DAY = 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
let ipCounter = 0;

/** A minimal Express-like request acting as `role` (or every account, without one). */
const req = (opts: { role?: string; cookies?: Record<string, string>; body?: any } = {}): any => ({
    body: opts.body ?? {},
    cookies: opts.cookies ?? {},
    headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 16) LifeLinkApp' },
    header: (name: string) => (name.toLowerCase() === 'x-lifelink-role' ? opts.role : undefined),
    baseUrl: '/auth',
    path: '/refresh',
    ip: `198.51.100.${++ipCounter}`,
});

/** A fake database: the user_sessions table plus the account rows the controllers read. */
const fakeDb = (opts: { passwordHash?: string } = {}) => {
    const sessions = new Map<string, any>();
    const state = { adminActive: true };
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO user_sessions')) {
            const [id, user_id, role, token_hash, persistent, expires_at] = params;
            sessions.set(id, { user_id, role, token_hash, persistent, created_at: new Date(), expires_at, revoked_at: null });
            return { rows: [] };
        }
        if (sql.includes('FROM user_sessions s JOIN users u')) {
            const row = sessions.get(params[0]);
            return { rows: row ? [{ ...row, name: 'Asha Patil', email: 'asha@example.com', user_role: row.role }] : [] };
        }
        if (sql.includes('SET last_used_at')) {
            sessions.get(params[0]).expires_at = params[1];
            return { rows: [] };
        }
        if (sql.includes('SET revoked_at') && sql.includes('token_hash')) {
            const row = sessions.get(params[0]);
            if (row && row.token_hash === params[1]) row.revoked_at = new Date();
            return { rows: [] };
        }
        if (sql.includes('SELECT active FROM admin_profiles')) return { rows: [{ active: state.adminActive }] };
        if (sql.includes('FROM admin_profiles')) return { rows: [{ is_national: true, state: null, cities: [] }] };
        if (sql.includes('FROM donors WHERE user_id')) return { rows: [{ blood_group: 'O+', city: 'Pune' }] };
        if (sql.includes('SELECT * FROM users WHERE email')) {
            return { rows: [{ id: 5, name: 'Asha Patil', email: 'asha@example.com', role: 'donor', password_hash: opts.passwordHash }] };
        }
        return { rows: [] };
    });
    return { sessions, state };
};
const idOf = (value: string) => value.split('.')[0]!;

test('a kept sign-in stores only a hash of its token, and only works for its own account type', async () => {
    const { sessions } = fakeDb();
    const kept = await startKeptSession(5, 'donor', true, 'Mozilla/5.0');
    assert.match(kept.value, /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    const secret = kept.value.split('.')[1]!;
    assert.equal(sessions.get(idOf(kept.value)).token_hash, sha256(secret));
    assert.ok(!JSON.stringify([...sessions.values()]).includes(secret), 'the token itself is never stored');

    assert.equal((await resumeKeptSession(kept.value, 'donor'))?.user.id, 5);
    assert.equal(await resumeKeptSession(kept.value, 'hospital'), null);
    assert.equal(await resumeKeptSession(`${idOf(kept.value)}.${'A'.repeat(43)}`, 'donor'), null, 'a wrong secret');
    assert.equal(await resumeKeptSession('not-a-token', 'donor'), null);
});

test('kept: renews for 30 days from the last use, at most 90 days in all; not kept: never renews', async () => {
    const { sessions } = fakeDb();
    const kept = await startKeptSession(5, 'donor', true);
    sessions.get(idOf(kept.value)).created_at = new Date(Date.now() - 80 * DAY); // signed in 80 days ago
    const left = (await resumeKeptSession(kept.value, 'donor'))!.session.expiresAt.getTime() - Date.now();
    assert.ok(left > 9 * DAY && left < 11 * DAY, 'about 10 days left, not another 30');

    sessions.get(idOf(kept.value)).expires_at = new Date(Date.now() - 1000);
    assert.equal(await resumeKeptSession(kept.value, 'donor'), null, 'an expired sign-in has ended');

    const browserOnly = await startKeptSession(5, 'donor', false);
    const ends = sessions.get(idOf(browserOnly.value)).expires_at.getTime();
    assert.ok(ends - Date.now() <= 12 * 60 * 60 * 1000);
    assert.equal((await resumeKeptSession(browserOnly.value, 'donor'))!.session.expiresAt.getTime(), ends);
});

test('refresh renews the 30-minute session from the kept sign-in', async () => {
    fakeDb();
    const kept = await startKeptSession(5, 'donor', true);
    const res = fakeRes();
    await refreshSession(req({ role: 'donor', cookies: { ll_donor_keep: kept.value } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.cookies).sort(), ['ll_donor', 'll_donor_keep']);
    assert.ok(res.cookieOptions.ll_donor_keep.maxAge > 29 * DAY, 'the kept cookie lasts another 30 days');
    assert.equal(res.cookieOptions.ll_donor_keep.path, '/auth');
    assert.equal(res.cookieOptions.ll_donor_keep.httpOnly, true);
    assert.equal(res.body.users[0].email, 'asha@example.com');
    assert.equal(res.body.users[0].blood_group, 'O+');
});

test('after signing out, the kept sign-in can no longer renew anything', async () => {
    fakeDb();
    const kept = await startKeptSession(5, 'donor', true);
    const out = fakeRes();
    await logout(req({ role: 'donor', cookies: { ll_donor_keep: kept.value } }), out);
    assert.ok(out.cleared.includes('ll_donor_keep'));

    const res = fakeRes();
    await refreshSession(req({ role: 'donor', cookies: { ll_donor_keep: kept.value } }), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(Object.keys(res.cookies), []);
    assert.ok(res.cleared.includes('ll_donor_keep'));
});

test('a removed admin cannot renew their session, and the kept sign-in is ended', async () => {
    const { sessions, state } = fakeDb();
    const kept = await startKeptSession(9, 'admin', true);
    state.adminActive = false;
    const res = fakeRes();
    await refreshSession(req({ role: 'admin', cookies: { ll_admin_keep: kept.value } }), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(Object.keys(res.cookies), []);
    assert.ok(sessions.get(idOf(kept.value)).revoked_at);
});

test('without a role, refresh restores every account kept on the device (the app does this when it opens)', async () => {
    fakeDb();
    const donor = await startKeptSession(5, 'donor', true);
    const hospital = await startKeptSession(7, 'hospital', true);
    const res = fakeRes();
    await refreshSession(req({ cookies: { ll_donor_keep: donor.value, ll_hospital_keep: hospital.value } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.users.map((u: any) => u.role).sort(), ['donor', 'hospital']);

    const none = fakeRes();
    await refreshSession(req(), none);
    assert.equal(none.statusCode, 200);
    assert.deepEqual(none.body, { users: [] });
});

test('donor sign-in: "keep me signed in" keeps the cookie for 30 days; otherwise it ends with the browser', async () => {
    fakeDb({ passwordHash: await bcrypt.hash('Str0ng*Pass', 4) });
    const kept = fakeRes();
    await login(req({ body: { email: 'asha@example.com', password: 'Str0ng*Pass', remember: true } }), kept);
    assert.equal(kept.statusCode, 200);
    assert.ok(kept.cookieOptions.ll_donor_keep.maxAge >= 29 * DAY);

    const browserOnly = fakeRes();
    await login(req({ body: { email: 'asha@example.com', password: 'Str0ng*Pass' } }), browserOnly);
    assert.equal(browserOnly.statusCode, 200);
    assert.ok(browserOnly.cookies.ll_donor_keep);
    assert.equal(browserOnly.cookieOptions.ll_donor_keep.maxAge, undefined, 'no expiry: a browser-session cookie');
});
