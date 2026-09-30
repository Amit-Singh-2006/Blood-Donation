import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import * as db from '../src/config/db';
import initDb from '../src/config/initDb';

afterEach(() => mock.restoreAll());

/** A fake pg client recording the first words of every statement. */
const fakeClient = (answer: (sql: string) => any[]) => {
    const calls: string[] = [];
    let released = 0;
    const client = {
        query: async (sql: string) => {
            calls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
            return { rows: answer(sql) };
        },
        release: () => { released++; },
    };
    mock.method(db.default, 'connect', async () => client);
    return { calls, released: () => released };
};
const ranSchema = (calls: string[]) => calls.some((c) => c.startsWith('-- Users Table'));

test('cold starts skip the table-locking DDL when the schema is already applied', async () => {
    // First start: nothing recorded yet, so the schema runs and its version is stored
    let recorded = '';
    mock.method(db.default, 'connect', async () => ({
        query: async (sql: string, params?: any[]) => {
            if (sql.includes('INSERT INTO app_schema')) recorded = params![0];
            return { rows: sql.includes('pg_try_advisory_xact_lock') ? [{ locked: true }] : [] };
        },
        release: () => { },
    }));
    await initDb();
    assert.match(recorded, /^[0-9a-f]{16}$/);
    mock.restoreAll();

    // Next start: same version recorded, so no DDL, just a short guarded check
    const second = fakeClient((sql) => (sql.includes('SELECT version FROM app_schema') ? [{ version: recorded }] : []));
    await initDb();
    assert.deepEqual(second.calls, ['BEGIN', 'SET LOCAL lock_timeout', 'SET LOCAL idle_in_transaction_session_timeout', 'SAVEPOINT version_check', 'SELECT version FROM', 'COMMIT']);
    assert.ok(!ranSchema(second.calls));
    assert.equal(second.released(), 1);
});

test('only one instance applies a schema change at a time', async () => {
    const busy = fakeClient((sql) => (sql.includes('pg_try_advisory_xact_lock') ? [{ locked: false }] : []));
    await initDb();
    assert.ok(!ranSchema(busy.calls));
    assert.ok(busy.calls.includes('ROLLBACK'));
    assert.equal(busy.released(), 1);
});

test('a changed schema is applied in one transaction with a lock timeout', async () => {
    const run = fakeClient((sql) => (sql.includes('pg_try_advisory_xact_lock') ? [{ locked: true }] : sql.includes('SELECT version') ? [{ version: 'old' }] : []));
    await initDb();
    assert.deepEqual(run.calls.slice(0, 6), ['BEGIN', 'SET LOCAL lock_timeout', 'SET LOCAL idle_in_transaction_session_timeout', 'SAVEPOINT version_check', 'SELECT version FROM', 'SELECT pg_try_advisory_xact_lock(724724) AS']);
    assert.ok(ranSchema(run.calls));
    assert.equal(run.calls.at(-1), 'COMMIT');
    assert.equal(run.released(), 1);
});

test('a failed migration rolls back and still returns the connection', async () => {
    mock.method(console, 'error', () => { });
    const calls: string[] = [];
    let released = 0;
    mock.method(db.default, 'connect', async () => ({
        query: async (sql: string) => {
            calls.push(sql.trim().split(/\s+/)[0]!);
            if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: true }] };
            if (sql.trim().startsWith('-- Users Table')) throw new Error('canceling statement due to lock timeout');
            return { rows: [] };
        },
        release: () => { released++; },
    }));
    await initDb();
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(released, 1);
});
