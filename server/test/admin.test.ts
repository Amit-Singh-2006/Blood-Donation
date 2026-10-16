import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { getDonors, getOverview } from '../src/controllers/adminController';
import { inviteCodeMatches } from '../src/controllers/authController';

afterEach(() => mock.restoreAll());

const national = { adminScope: { userId: 1, isNational: true, state: null, cities: [] } } as any;

const counts = {
    donors: 12, hospitals: 3, hospitals_verified: 2, requests: 9, requests_active: 2, requests_completed: 5,
    requests_exhausted: 1, requests_not_dispatched: 1, donations: 7, donations_30d: 4,
};

test('overview returns the counts, which message channels are set up and whether the timer runs', async () => {
    const keys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'SMTP_USER', 'SMTP_PASS'];
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k]; // server/.env may set them
    process.env.SMTP_USER = 'lifelink@example.com';
    process.env.SMTP_PASS = 'app password';
    const messages = { pending: 1, failed_24h: 2, sent_24h: 30 };
    mock.method(db, 'query', async (sql: string) => ({
        rows: sql.includes('FROM network_outbox') ? [messages] : sql.includes('cron.job') ? [{ active: true }] : [counts],
    }));
    try {
        const res = fakeRes();
        await getOverview(national, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, {
            ...counts,
            network_configured: true,
            messaging: { sms: false, whatsapp: false, email: true },
            network_timer: true,
            messages,
            jurisdiction: 'All India',
        });
        assert.doesNotMatch(JSON.stringify(res.body), /app password/, 'never the settings themselves');
    } finally {
        for (const k of keys) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    }
});

test('overview still loads when the database has no pg_cron', async () => {
    mock.method(db, 'query', async (sql: string) => {
        if (sql.includes('cron.job')) throw new Error('relation "cron.job" does not exist');
        return { rows: [sql.includes('FROM network_outbox') ? { pending: 0, failed_24h: 0, sent_24h: 0 } : counts] };
    });
    const res = fakeRes();
    await getOverview(national, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.network_timer, false);
});

test('overview hides database errors behind a generic 500', async () => {
    mock.method(db, 'query', async () => { throw new Error('relation "hospitals" does not exist'); });
    mock.method(console, 'error', () => {});

    const res = fakeRes();
    await getOverview(national, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Internal server error.' });
});

test('donor list never selects password hashes', async () => {
    const rows = [{ id: 4, name: 'Asha', email: 'asha@example.in', blood_group: 'O-', donations: 2 }];
    const queryMock = mock.method(db, 'query', async () => ({ rows, rowCount: 1 }));

    const res = fakeRes();
    await getDonors(national, res);
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
