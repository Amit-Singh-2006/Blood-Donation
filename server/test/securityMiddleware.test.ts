import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import { injectionGuard } from '../src/middleware/securityMiddleware';

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
    assert.equal(run({ name: 'a*b' }).passed, false);
    assert.equal(run({ name: 'a*b' }).res.statusCode, 400);
});
