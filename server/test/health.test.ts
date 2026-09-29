import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { describeDatabaseTarget, healthCheck } from '../src/controllers/healthController';

afterEach(() => mock.restoreAll());

test('describes where DATABASE_URL points without revealing it', () => {
    assert.deepEqual(describeDatabaseTarget('postgresql://postgres.abc:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'),
        { target: 'supabase-pooler', port: '6543' });
    assert.deepEqual(describeDatabaseTarget('postgresql://postgres:secret@db.abc.supabase.co:5432/postgres'),
        { target: 'supabase-direct', port: '5432' });
    assert.deepEqual(describeDatabaseTarget('"postgresql://x"'), { target: 'unparseable' });
    assert.deepEqual(describeDatabaseTarget(undefined), { target: 'missing' });
});

test('/health reports the driver error code but never the message', async () => {
    mock.method(db, 'query', async () => {
        throw Object.assign(new Error('password authentication failed for postgresql://postgres:secret@host'), { code: '28P01' });
    });
    const res = fakeRes();
    await healthCheck({} as any, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.database.error_code, '28P01');
    assert.doesNotMatch(JSON.stringify(res.body), /secret|password/);
});
