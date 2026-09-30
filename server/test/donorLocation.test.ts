import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { getNetworkStatus, shareLocation, stopSharingLocation } from '../src/controllers/donorController';
import { getDonorLocations } from '../src/controllers/hospitalController';

afterEach(() => {
    mock.restoreAll();
    delete process.env.N8N_WEBHOOK_KEY;
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const donorReq = (body: unknown = {}, params: Record<string, string> = {}) => ({ user: { id: 24, role: 'donor' }, body, params }) as any;
const report = { match_id: 31, latitude: 31.326, longitude: 75.5762, accuracy_m: 12.6 };
const accepted = { match_id: 31, request_id: 17, status: 'accepted', hospital_name: 'Civil Hospital', hospital_city: 'Jalandhar' };

/** Answers queries by the first matching SQL fragment and records every call. */
const fakeDb = (answers: [string, any[]][]) => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        calls.push({ sql, params });
        const hit = answers.find(([fragment]) => sql.includes(fragment));
        return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
    });
    return calls;
};

test('a donor can start sharing only for a request they accepted', async () => {
    process.env.N8N_WEBHOOK_KEY = 'k';
    const calls = fakeDb([['SELECT phone FROM donors', [{ phone: '98765 43210' }]]]);
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(200, { registered: true, alerts: [accepted] }));

    const res = fakeRes();
    await shareLocation(donorReq(report), res);
    assert.equal(res.statusCode, 200);
    assert.equal(fetchMock.mock.callCount(), 1, 'the network confirms the YES once');
    const insert = calls.find((c) => c.sql.includes('INSERT INTO donor_locations'))!;
    assert.deepEqual(insert.params, [31, 17, 24, 31.326, 75.5762, 13]);

    fetchMock.mock.mockImplementation(async () => json(200, { registered: true, alerts: [{ ...accepted, status: 'awaiting_reply' }] }));
    const other = fakeRes();
    await shareLocation(donorReq({ ...report, match_id: 99 }), other);
    assert.equal(other.statusCode, 403);
});

test('later position reports just move the pin, without asking the network', async () => {
    fakeDb([['UPDATE donor_locations', [{ match_id: 31 }]]]);
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(500, {}));
    const res = fakeRes();
    await shareLocation(donorReq(report), res);
    assert.equal(res.statusCode, 200);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('stopping deletes only this donor\'s position', async () => {
    const calls = fakeDb([]);
    const res = fakeRes();
    await stopSharingLocation(donorReq({}, { matchId: '31' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls[0]!.params, [31, 24]);
    assert.match(calls[0]!.sql, /donor_user_id = \$2/);
});

test('a hospital sees only donors coming to its own requests, and only recent positions', async () => {
    const calls = fakeDb([['FROM donor_locations l', [{ match_id: 31, request_id: 9, latitude: '31.326000', longitude: '75.576200', accuracy_m: 13, updated_at: '2026-09-30T06:00:00Z' }]]]);
    const res = fakeRes();
    await getDonorLocations({ user: { id: 22, role: 'hospital' } } as any, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body[0], { match_id: 31, request_id: 9, latitude: 31.326, longitude: 75.5762, accuracy_m: 13, updated_at: '2026-09-30T06:00:00Z' });
    const select = calls.find((c) => c.sql.includes('FROM donor_locations l'))!;
    assert.match(select.sql, /r\.hospital_id = \$1/);
    assert.match(select.sql, /30 minutes/);
    assert.deepEqual(select.params, [22]);
});

test('donors see the hospital\'s location, and its phone only once they said YES', async () => {
    process.env.N8N_WEBHOOK_KEY = 'k';
    fakeDb([
        ['FROM donors d JOIN users u', [{ name: 'Amit', phone: '98765 43210', blood_group: 'A-', city: 'Jalandhar', gender: 'male' }]],
        ['FROM blood_requests r JOIN hospitals h', [
            { network_request_id: 17, latitude: '31.326000', longitude: '75.576200', address: 'GT Road', city: 'Jalandhar', state: 'Punjab', contact_number: '+915550000951' },
            { network_request_id: 18, latitude: null, longitude: null, address: null, city: 'Ludhiana', state: 'Punjab', contact_number: '+915550000952' },
        ]],
        ['SELECT match_id FROM donor_locations', [{ match_id: 31 }]],
    ]);
    mock.method(globalThis, 'fetch', async () => json(200, {
        registered: true,
        alerts: [accepted, { match_id: 32, request_id: 18, status: 'awaiting_reply', hospital_name: 'DMC', hospital_city: 'Ludhiana' }],
    }));
    const res = fakeRes();
    await getNetworkStatus(donorReq(), res);
    assert.equal(res.statusCode, 200);
    const [yes, pending] = res.body.alerts;
    assert.deepEqual(yes.hospital_location, { latitude: 31.326, longitude: 75.5762, address: 'GT Road, Jalandhar, Punjab' });
    assert.equal(yes.hospital_contact, '+915550000951');
    assert.equal(yes.sharing_location, true);
    assert.equal(pending.hospital_location, null);
    assert.equal(pending.hospital_contact, null, 'no hospital number before the donor accepts');
    assert.equal(pending.sharing_location, false);
});
