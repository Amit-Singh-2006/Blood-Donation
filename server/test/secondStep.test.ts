import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { verifySecondStep } from '../src/controllers/authController';
import { base32Decode, currentStep, hashBackupCode, sealSecret, signPendingToken, totpAt } from '../src/utils/mfa';

process.env.JWT_SECRET ??= 'test-jwt-secret';
afterEach(() => mock.restoreAll());

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const codeNow = () => totpAt(base32Decode(SECRET), currentStep());
let ipCounter = 0;
// A fresh IP per request, so the brute-force slow-down never delays the tests
const req = (token: string, code: string): any => ({ body: { token, code }, ip: `203.0.113.${++ipCounter}`, path: '/mfa/verify' });

/** A fake database holding one admin account with two-step verification. */
const fakeAccount = (mfa: { enabled: boolean; last_step?: number | null; backup?: string[] }) => {
    const state = { last_step: mfa.last_step ?? null, backup: new Set(mfa.backup ?? []), enabledNow: false };
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 42, name: 'Rahul Verma', email: 'rahul@example.com', role: 'admin' }] };
        if (sql.includes('SELECT enabled, secret_enc, last_step FROM user_mfa')) {
            return { rows: [{ enabled: mfa.enabled, secret_enc: sealSecret(SECRET), last_step: state.last_step }] };
        }
        if (sql.includes('SELECT active FROM admin_profiles')) return { rows: [{ active: true }] };
        if (sql.includes('SELECT is_national, state, cities FROM admin_profiles')) {
            return { rows: [{ is_national: false, state: 'Maharashtra', cities: ['Pune'] }] };
        }
        if (sql.includes('SET enabled = TRUE')) { state.enabledNow = true; state.last_step = params[1]; return { rows: [] }; }
        if (sql.includes('SET last_step')) { state.last_step = params[1]; return { rows: [] }; }
        if (sql.includes('backup_hashes - ')) {
            if (!state.backup.delete(params[1])) return { rows: [] };
            return { rows: [{ codes_left: state.backup.size }] };
        }
        return { rows: [] };
    });
    return state;
};

test('the right authenticator code signs an admin in, and the same code cannot be used twice', async () => {
    const state = fakeAccount({ enabled: true });
    const token = signPendingToken(42, 'admin', 'verify');
    const code = codeNow();

    const res = fakeRes();
    await verifySecondStep(req(token, code), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.cookies), ['ll_admin', 'll_admin_keep']);
    assert.equal(res.body.user.jurisdiction, 'Pune, Maharashtra');
    assert.equal(state.last_step, currentStep());

    const replay = fakeRes();
    await verifySecondStep(req(token, code), replay);
    assert.equal(replay.statusCode, 401);
    assert.equal(replay.body.error, 'mfa_wrong_code');
    assert.deepEqual(Object.keys(replay.cookies), []);
});

test('a wrong code or an expired ticket gets no session', async () => {
    fakeAccount({ enabled: true });
    const wrong = fakeRes();
    const notTheCode = codeNow() === '000000' ? '111111' : '000000';
    await verifySecondStep(req(signPendingToken(42, 'admin', 'verify'), notTheCode), wrong);
    assert.equal(wrong.statusCode, 401);
    assert.deepEqual(Object.keys(wrong.cookies), []);

    const expired = fakeRes();
    await verifySecondStep(req('not-a-real-ticket-at-all', codeNow()), expired);
    assert.equal(expired.statusCode, 401);
    assert.equal(expired.body.error, 'mfa_expired');
});

test('a ticket must match the account state: no skipping setup with a verify ticket', async () => {
    fakeAccount({ enabled: false });
    const res = fakeRes();
    await verifySecondStep(req(signPendingToken(42, 'admin', 'verify'), codeNow()), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(Object.keys(res.cookies), []);
});

test('finishing setup turns two-step on and returns 10 backup codes, once', async () => {
    const state = fakeAccount({ enabled: false });
    const res = fakeRes();
    await verifySecondStep(req(signPendingToken(42, 'admin', 'setup'), codeNow()), res);
    assert.equal(res.statusCode, 200);
    assert.ok(state.enabledNow);
    assert.equal(res.body.backup_codes.length, 10);
    assert.deepEqual(Object.keys(res.cookies), ['ll_admin', 'll_admin_keep']);
});

test('"keep me signed in" from the password step carries through the code step', async () => {
    fakeAccount({ enabled: true });
    const kept = fakeRes();
    await verifySecondStep(req(signPendingToken(42, 'admin', 'verify', true), codeNow()), kept);
    assert.equal(kept.statusCode, 200);
    assert.ok(kept.cookieOptions.ll_admin_keep.maxAge > 29 * 24 * 60 * 60 * 1000);
});

test('a backup code works once, for a lost phone', async () => {
    const backup = 'K7QM-X2PD';
    const state = fakeAccount({ enabled: true, backup: [hashBackupCode(backup), hashBackupCode('ABCD-EFGH')] });
    const token = signPendingToken(42, 'admin', 'verify');

    const first = fakeRes();
    await verifySecondStep(req(token, 'k7qm x2pd'), first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.backup_codes_left, 1);
    assert.equal(state.backup.size, 1);

    const again = fakeRes();
    await verifySecondStep(req(token, backup), again);
    assert.equal(again.statusCode, 401);
});
