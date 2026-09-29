import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import { injectionGuard, parseOrigins, strictCorsGuard } from '../src/middleware/securityMiddleware';

const run = (body: unknown) => {
    const res = fakeRes();
    let passed = false;
    injectionGuard({ body, query: {}, params: {} } as any, res, () => { passed = true; });
    return { passed, res };
};

test('allows passwords with the special characters the password policy requires', () => {
    for (const password of ['Blood(Donor)1', 'Str0ng*Pass', 'Back\\slash9A']) {
        assert.equal(run({ email: 'donor@example.com', password }).passed, true, password);
    }
});

test('still blocks injection patterns in every other field', () => {
    assert.equal(run({ email: '{"$ne": null}', password: 'x' }).passed, false);
    assert.equal(run({ name: '$where', password: 'Valid*1a' }).passed, false);
    assert.equal(run({ name: 'a\u0000b' }).passed, false);
    assert.equal(run({ name: 'a\u0000b' }).res.statusCode, 400);
});

test('lets ordinary names and references through', () => {
    for (const name of ['AIIMS (New Delhi)', "St. John's Medical College", 'Ram Manohar Lohia & Sons', 'ICU (Bed 7)*', 'Ward 3 \\ Bed 2']) {
        assert.equal(run({ hospital_name: name }).passed, true, name);
    }
});

const corsCheck = (origin?: string) => {
    const res = fakeRes();
    let passed = false;
    strictCorsGuard({ headers: origin ? { origin } : {} } as any, res, () => { passed = true; });
    return { passed, res };
};

test('lets the deployed frontend call the API without FRONTEND_URL', () => {
    assert.equal(corsCheck('https://blood-donation-frontend-delta.vercel.app').passed, true);
    assert.equal(corsCheck('http://localhost:5173').passed, true);
    assert.equal(corsCheck().passed, true);
});

test('rejects origins that are not on the allowlist', () => {
    const { passed, res } = corsCheck('https://evil.example.com');
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
});

test('FRONTEND_URL accepts a comma-separated list and normalises each entry to an origin', () => {
    assert.deepEqual(
        parseOrigins(' https://a.example.com/ ,https://b.example.com/app,not a url,'),
        ['https://a.example.com', 'https://b.example.com'],
    );
    assert.deepEqual(parseOrigins(undefined), []);
});
