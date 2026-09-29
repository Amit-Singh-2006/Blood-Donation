import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { getDonors, getOverview } from '../src/controllers/adminController';
import { inviteCodeMatches } from '../src/controllers/authController';

afterEach(() => {
    mock.restoreAll();
    delete process.env.N8N_WEBHOOK_KEY;
});

const counts = {
    donors: 12, hospitals: 3, hospitals_verified: 2, requests: 9, requests_active: 2, requests_completed: 5,
    requests_exhausted: 1, requests_not_dispatched: 1, donations: 7, donations_30d: 4,
};

test('overview returns the database counts and whether the donor network is configured', async () => {
    delete process.env.N8N_WEBHOOK_KEY; // server/.env may set it
    mock.method(db, 'query', async () => ({ rows: [counts], rowCount: 1 }));

    const res = fakeRes();
    await getOverview({} as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ...counts, network_configured: false });

    process.env.N8N_WEBHOOK_KEY = 'server-key';
    const configured = fakeRes();
    await getOverview({} as any, configured);
    assert.equal(configured.body.network_configured, true);
});

test('overview hides database errors behind a generic 500', async () => {
    mock.method(db, 'query', async () => { throw new Error('relation "hospitals" does not exist'); });
    mock.method(console, 'error', () => {});

    const res = fakeRes();
    await getOverview({} as any, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Internal server error.' });
});

test('donor list never selects password hashes', async () => {
    const rows = [{ id: 4, name: 'Asha', email: 'asha@example.in', blood_group: 'O-', donations: 2 }];
    const queryMock = mock.method(db, 'query', async () => ({ rows, rowCount: 1 }));

    const res = fakeRes();
    await getDonors({} as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, rows);
    const sql = queryMock.mock.calls[0]!.arguments[0] as string;
    assert.doesNotMatch(sql, /password/i);
    assert.match(sql, /LIMIT 500/);
});

test('admin invite code must match exactly, and sign-up is closed when it is unset', () => {
    assert.equal(inviteCodeMatches('Ab3-xyz', 'Ab3-xyz'), true);
    assert.equal(inviteCodeMatches('ab3-xyz', 'Ab3-xyz'), false);
    assert.equal(inviteCodeMatches('Ab3-xyz ', 'Ab3-xyz'), false);
    assert.equal(inviteCodeMatches('', 'Ab3-xyz'), false);
    assert.equal(inviteCodeMatches(undefined, 'Ab3-xyz'), false);
    assert.equal(inviteCodeMatches({ $ne: '' }, 'Ab3-xyz'), false);
    assert.equal(inviteCodeMatches('anything', ''), false);
});
