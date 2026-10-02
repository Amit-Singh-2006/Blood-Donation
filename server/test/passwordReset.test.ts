import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import * as network from '../src/services/donorNetwork';
import {
    confirmResetSecondStep, forgotPassword, resetPassword, resetTiming, verifyResetCode,
} from '../src/controllers/passwordResetController';
import { readResetTicket, signResetTicket } from '../src/utils/passwordReset';
import { base32Decode, currentStep, hashBackupCode, sealSecret, totpAt } from '../src/utils/mfa';

process.env.JWT_SECRET ??= 'test-jwt-secret';
resetTiming.minimumMs = 0;
afterEach(() => mock.restoreAll());

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const appCode = () => totpAt(base32Decode(SECRET), currentStep());
const notThe = (code: string) => (code === '000000' ? '111111' : '000000');
let ipCounter = 0;
// A fresh IP per request, so the brute-force slow-down never delays the tests
const req = (body: any): any => ({ body, ip: `192.0.2.${++ipCounter}`, path: '/password', headers: {} });

/** A fake database with one account, its resets and (optionally) two-step verification. */
const fakeWorld = async (opts: { role?: string; twoStep?: boolean; backup?: string[] } = {}) => {
    const user = { id: 7, name: 'Asha Patil', email: 'asha@example.com', role: opts.role ?? 'donor', password_hash: await bcrypt.hash('Old*Pass123', 4) };
    const resets: any[] = [];
    const mfa = opts.twoStep ? { enabled: true, secret_enc: sealSecret(SECRET), last_step: null as number | null, backup: new Set(opts.backup ?? []) } : null;
    const emails: any[] = [];
    let sessionsEnded = 0;
    const latest = () => resets[resets.length - 1];
    mock.method(network, 'sendAccountEmail', async (payload: any) => { emails.push(payload); });
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM users WHERE lower(email) = $1')) return { rows: params[0] === user.email ? [user] : [] };
        if (sql.includes('AS last_hour')) {
            const mine = resets.filter((r) => r.user_id === params[0]);
            return { rows: [{ last_hour: mine.length, latest: mine.length ? mine[mine.length - 1].created_at : null }] };
        }
        if (sql.includes('INSERT INTO password_resets')) {
            resets.push({ id: params[0], user_id: params[1], code_hash: params[2], expires_at: params[3], attempts: 0, created_at: new Date(), verified_at: null, second_step_at: null, used_at: null });
            return { rows: [] };
        }
        if (sql.includes('WHERE lower(u.email) = $1 ORDER BY r.created_at DESC')) {
            return { rows: params[0] === user.email && latest() ? [{ ...latest(), role: user.role }] : [] };
        }
        if (sql.includes('SET attempts = attempts + 1')) {
            const r = resets.find((x) => x.id === params[0]);
            if (!r || r.attempts >= params[1]) return { rows: [] };
            r.attempts += 1;
            return { rows: [{ attempts: r.attempts }] };
        }
        if (sql.includes('SET verified_at')) {
            resets.find((x) => x.id === params[0]).verified_at ??= new Date();
            return { rows: [] };
        }
        if (sql.includes('FROM password_resets r JOIN users u ON u.id = r.user_id') && sql.includes('WHERE r.id = $1')) {
            const r = resets.find((x) => x.id === params[0] && x.user_id === params[1]);
            const open = r && !r.used_at && r.expires_at.getTime() > Date.now() && r === latest();
            return { rows: open ? [{ ...r, email: user.email, name: user.name, role: user.role, password_hash: user.password_hash }] : [] };
        }
        if (sql.includes('FROM user_mfa WHERE user_id')) return { rows: mfa ? [mfa] : [] };
        if (sql.includes('SET last_step')) { mfa!.last_step = params[1]; return { rows: [] }; }
        if (sql.includes('backup_hashes - ')) {
            if (!mfa!.backup.delete(params[1])) return { rows: [] };
            return { rows: [{ codes_left: mfa!.backup.size }] };
        }
        if (sql.includes('SET second_step_at')) {
            resets.find((x) => x.id === params[0]).second_step_at = new Date();
            return { rows: [] };
        }
        if (sql.includes('SET used_at = now() WHERE id = $1 AND used_at IS NULL')) {
            const r = resets.find((x) => x.id === params[0] && !x.used_at);
            if (!r) return { rows: [] };
            r.used_at = new Date();
            return { rows: [{ id: r.id }] };
        }
        if (sql.includes('UPDATE users SET password_hash')) { user.password_hash = params[0]; return { rows: [] }; }
        if (sql.includes('UPDATE user_sessions SET revoked_at')) { sessionsEnded++; return { rows: [] }; }
        return { rows: [] };
    });
    return { user, resets, emails, ended: () => sessionsEnded };
};

const forgot = async (email: string) => { const res = fakeRes(); await forgotPassword(req({ email }), res); return res; };
const verify = async (email: string, code: string) => { const res = fakeRes(); await verifyResetCode(req({ email, code }), res); return res; };

test('a registered email gets a 6-digit code; an unknown one gets the same answer and no email', async () => {
    const { emails, resets } = await fakeWorld();
    const known = await forgot('asha@example.com');
    const unknown = await forgot('nobody@example.com');
    assert.equal(known.statusCode, 200);
    assert.deepEqual(unknown.body, known.body, 'the same answer either way');
    assert.equal(emails.length, 1);
    assert.equal(emails[0].type, 'reset_code');
    assert.equal(emails[0].to, 'asha@example.com');
    assert.match(emails[0].code, /^\d{6}$/);
    assert.equal(emails[0].needs_authenticator, false);
    assert.ok(!JSON.stringify(resets).includes(emails[0].code), 'only a keyed hash of the code is stored');
});

test('at most one code a minute per account, so nobody can flood an inbox', async () => {
    const { emails } = await fakeWorld();
    await forgot('asha@example.com');
    await forgot('asha@example.com');
    assert.equal(emails.length, 1);
});

test('wrong codes count down and then lock the code; the right code earns a reset ticket', async () => {
    const { emails } = await fakeWorld();
    await forgot('asha@example.com');
    const code = emails[0].code;
    const first = await verify('asha@example.com', notThe(code));
    assert.equal(first.statusCode, 400);
    assert.match(first.body.message, /4 tries left/);

    const right = await verify('asha@example.com', code);
    assert.equal(right.statusCode, 200);
    assert.equal(right.body.second_step, false);
    assert.ok(readResetTicket(right.body.token));

    for (let i = 0; i < 3; i++) await verify('asha@example.com', notThe(code));
    const locked = await verify('asha@example.com', code);
    assert.equal(locked.body.error, 'reset_code_locked', 'after 5 tries even the right code is refused');

    const noAccount = await verify('nobody@example.com', code);
    assert.equal(noAccount.body.error, 'reset_code_expired', 'no hint that the email has no account');
});

test('donor: email code, then a new password; signed out everywhere; each reset works once', async () => {
    const world = await fakeWorld();
    await forgot('asha@example.com');
    const { token } = (await verify('asha@example.com', world.emails[0].code)).body;

    const same = fakeRes();
    await resetPassword(req({ token, password: 'Old*Pass123' }), same);
    assert.equal(same.statusCode, 400, 'the current password is not a new one');

    const done = fakeRes();
    await resetPassword(req({ token, password: 'New*Pass456' }), done);
    assert.equal(done.statusCode, 200);
    assert.ok(await bcrypt.compare('New*Pass456', world.user.password_hash));
    assert.equal(world.ended(), 1, 'kept sign-ins on every device are ended');
    assert.equal(world.emails.at(-1).type, 'password_changed');

    const again = fakeRes();
    await resetPassword(req({ token, password: 'Other*Pass789' }), again);
    assert.equal(again.statusCode, 401);
    assert.ok(await bcrypt.compare('New*Pass456', world.user.password_hash));
});

test('admin with two-step verification: the email code alone cannot change the password', async () => {
    const world = await fakeWorld({ role: 'admin', twoStep: true });
    await forgot('asha@example.com');
    assert.equal(world.emails[0].needs_authenticator, true);
    const verified = await verify('asha@example.com', world.emails[0].code);
    assert.equal(verified.body.second_step, true);
    const token = verified.body.token;

    const skipped = fakeRes();
    await resetPassword(req({ token, password: 'New*Pass456' }), skipped);
    assert.equal(skipped.statusCode, 403);

    const wrongApp = fakeRes();
    await confirmResetSecondStep(req({ token, code: notThe(appCode()) }), wrongApp);
    assert.equal(wrongApp.statusCode, 401);

    const app = fakeRes();
    await confirmResetSecondStep(req({ token, code: appCode() }), app);
    assert.equal(app.statusCode, 200);

    const done = fakeRes();
    await resetPassword(req({ token, password: 'New*Pass456' }), done);
    assert.equal(done.statusCode, 200);
    assert.ok(await bcrypt.compare('New*Pass456', world.user.password_hash));
});

test('a hospital that lost its phone can use a backup code instead, once', async () => {
    const world = await fakeWorld({ role: 'hospital', twoStep: true, backup: [hashBackupCode('K7QM-X2PD')] });
    await forgot('asha@example.com');
    const { token } = (await verify('asha@example.com', world.emails[0].code)).body;
    const res = fakeRes();
    await confirmResetSecondStep(req({ token, code: 'k7qm x2pd' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.backup_codes_left, 0);
});

test('reset tickets can never pass as a session, and a bad ticket changes nothing', async () => {
    const id = '5b9f0d4e-8c1a-4f7e-9d2b-3a6c5e7f8a90';
    const ticket = signResetTicket(id, 7);
    assert.deepEqual(readResetTicket(ticket), { rid: id, uid: 7 });
    assert.throws(() => jwt.verify(ticket, process.env.JWT_SECRET as string));
    assert.equal(readResetTicket(jwt.sign({ rid: id, uid: 7 }, process.env.JWT_SECRET as string)), null);
    assert.equal(readResetTicket('nonsense'), null);
    const res = fakeRes();
    await resetPassword(req({ token: 'nonsense-nonsense-nonsense', password: 'New*Pass456' }), res);
    assert.equal(res.statusCode, 401);
});
