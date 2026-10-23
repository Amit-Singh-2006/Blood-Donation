import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { describeError, isTransient } from '../scripts/backup';

const withCode = (message: string, code: string) => Object.assign(new Error(message), { code });

test('a failed backup says why, even when the connection failed on every address', () => {
    // Node reports a connection that failed on every address as an AggregateError with an empty message
    const everyAddress = new AggregateError([
        withCode('connect ECONNREFUSED 13.200.110.68:6543', 'ECONNREFUSED'),
        withCode('connect ENETUNREACH 2406:da1a::1:6543', 'ENETUNREACH'),
    ], '');
    assert.equal(describeError(everyAddress), 'connect ECONNREFUSED 13.200.110.68:6543; connect ENETUNREACH 2406:da1a::1:6543');
    assert.equal(describeError(new AggregateError([], '')), 'could not connect');
    assert.equal(describeError(withCode('socket hang up', 'ECONNRESET')), 'socket hang up (ECONNRESET)');
    assert.equal(describeError('plain text'), 'plain text');
});

test('the backup tries again when the PC is not online yet, but not for problems a person must fix', () => {
    assert.ok(isTransient(new AggregateError([withCode('connect ETIMEDOUT', 'ETIMEDOUT')], '')));
    assert.ok(isTransient(new Error('Connection terminated due to connection timeout')));
    assert.ok(isTransient(withCode('getaddrinfo EAI_AGAIN aws-1-ap-south-1.pooler.supabase.com', 'EAI_AGAIN')));
    assert.equal(isTransient(new Error('No backup key at C:\\lifelink-private\\backup-key.txt. Put back the copy you saved.')), false);
    assert.equal(isTransient(new Error('Restore check failed for users (1 of 2)')), false);
    assert.equal(isTransient(new Error('DATABASE_URL is not set (server/.env).')), false);
});
