import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authCookieOptions } from '../src/utils/authCookie';

const withNodeEnv = <T>(value: string, fn: () => T): T => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = value;
    try {
        return fn();
    } finally {
        process.env.NODE_ENV = previous;
    }
};

test('production auth cookie is sent on cross-site API calls from the frontend', () => {
    const options = withNodeEnv('production', authCookieOptions);
    assert.equal(options.sameSite, 'none');
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
    // Kept by browsers that block third-party cookies (otherwise sign-in bounces back to /login)
    assert.equal(options.partitioned, true);
});

test('local development keeps a Lax cookie over plain http', () => {
    const options = withNodeEnv('development', authCookieOptions);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.secure, false);
    assert.equal(options.partitioned, undefined);
});
