import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { createHospitalRequest, getHospitalRequests } from '../src/controllers/hospitalController';
import { setHospitalVerification } from '../src/controllers/adminController';

afterEach(() => {
    mock.restoreAll();
    delete process.env.N8N_WEBHOOK_KEY;
});

const hospital = { hospital_name: 'AIIMS Trauma Centre', city: 'Delhi', contact_number: '98765 43210', latitude: '28.567200', longitude: '77.210000', is_verified: true };
const hospitalToken = '410dcab5-0440-4787-a556-2d1a72651973';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const req = (body?: unknown) => ({ user: { id: 7, role: 'hospital' }, body } as any);

/** Answers queries by the first matching SQL fragment and records every call. */
const fakeDb = (answers: [string, any][]) => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        calls.push({ sql, params });
        const hit = answers.find(([fragment]) => sql.includes(fragment));
        return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
    });
    return calls;
};

test('unverified hospitals cannot dispatch requests', async () => {
    const calls = fakeDb([['FROM hospitals', [{ ...hospital, is_verified: false }]]]);
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(201, {}));
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'O-', units_required: 2, urgency: 'Emergency' }), res);

    assert.equal(res.statusCode, 403);
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO blood_requests')));
});

test('a verified hospital request is saved, dispatched, and the hospital token stays server-side', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    const row = { id: 5, hospital_id: 7, blood_group: 'O-', status: 'Open' };
    const calls = fakeDb([
        ['FROM hospitals', [hospital]],
        ['INSERT INTO blood_requests', [row]],
        ['UPDATE blood_requests SET network_request_id', [{ ...row, network_request_id: 42, tracking_token: 't-1', hospital_token: hospitalToken }]],
    ]);
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(201, {
        status: 'dispatched', request_id: 42, hospital_token: hospitalToken, compatible_donors: 6,
        donors_alerted: [{ rank: 1 }, { rank: 2 }], donors_on_standby: 4, escalation_minutes: 10,
        tracking_url: 'https://n8n/webhook/lifelink/request-status?token=7490af64-2df9-438f-a6f5-29be3f680d69',
    }));
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'O-', units_required: 2, urgency: 'Emergency', patient_ref: 'ICU-7' }), res);

    assert.equal(res.statusCode, 201);
    const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
    assert.match(url, /\/emergency-request$/);
    const sent = JSON.parse(init.body as string);
    assert.equal(sent.hospital_name, 'AIIMS Trauma Centre');
    assert.equal(sent.hospital_contact, '+919876543210');
    assert.equal(sent.latitude, 28.5672);
    assert.equal(sent.patient_ref, 'ICU-7');

    const update = calls.find((c) => c.sql.includes('SET network_request_id'))!;
    assert.deepEqual(update.params, [42, '7490af64-2df9-438f-a6f5-29be3f680d69', hospitalToken, 'Open', 5]);
    assert.equal(res.body.network.donors_alerted, 2);
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(hospitalToken));
});

test('a request the network cannot take is still saved, with a warning for the hospital', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(console, 'error', () => { });
    const calls = fakeDb([['FROM hospitals', [hospital]], ['INSERT INTO blood_requests', [{ id: 6 }]]]);
    mock.method(globalThis, 'fetch', async () => json(400, { status: 'rejected', errors: [{ path: 'units_required', message: 'Must be at most 20' }] }));
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'A+', units_required: 50, urgency: 'Normal' }), res);

    assert.equal(res.statusCode, 201);
    assert.match(res.body.warning, /Must be at most 20/);
    assert.ok(calls.some((c) => c.sql.includes('SET network_error')));
});

test('the request list merges live progress, syncs status and records confirmed donations', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    const calls = fakeDb([
        ['FROM blood_requests', [{ id: 5, status: 'Open', network_request_id: 42, hospital_token: hospitalToken, tracking_token: 't-1' }]],
    ]);
    mock.method(globalThis, 'fetch', async () => json(200, {
        requests: [{
            request_id: 42, found: true, status: 'Completed',
            donors: [{ match_id: 11, name: 'Rohan', phone: '+919876500000', status: 'donated', responded_at: '2026-09-29T10:00:00Z' }],
        }],
    }));
    const res = fakeRes();
    await getHospitalRequests(req(), res);

    assert.equal(res.statusCode, 200);
    const [first] = res.body.requests;
    assert.equal(first.status, 'Completed');
    assert.equal(first.live.donors[0].name, 'Rohan');
    assert.equal(first.hospital_token, undefined);
    assert.ok(calls.some((c) => c.sql.includes('UPDATE blood_requests SET status') && c.params[0] === 'Completed'));
    const donation = calls.find((c) => c.sql.includes('INSERT INTO donations'))!;
    assert.deepEqual(donation.params, ['+919876500000', 7, '2026-09-29T10:00:00Z', 11]);
});

test('the request list still loads when the network is down', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(console, 'error', () => { });
    fakeDb([['FROM blood_requests', [{ id: 5, status: 'Open', network_request_id: 42, hospital_token: hospitalToken }]]]);
    mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
    const res = fakeRes();
    await getHospitalRequests(req(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requests[0].live, null);
    assert.match(res.body.network_error, /unavailable/);
});

test('admins verify hospitals by id', async () => {
    fakeDb([['UPDATE hospitals SET is_verified', [{ id: 7, hospital_name: 'AIIMS', is_verified: true }]]]);
    let res = fakeRes();
    await setHospitalVerification({ params: { id: '7' }, body: { verified: true } } as any, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.is_verified, true);

    res = fakeRes();
    await setHospitalVerification({ params: { id: 'abc' }, body: { verified: true } } as any, res);
    assert.equal(res.statusCode, 400);
});
