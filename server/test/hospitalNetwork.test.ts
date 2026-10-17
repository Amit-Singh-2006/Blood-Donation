import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import * as network from '../src/services/donorNetwork';
import { NetworkError } from '../src/services/donorNetwork';
import { createHospitalRequest, getHospitalRequests } from '../src/controllers/hospitalController';

afterEach(() => mock.restoreAll());

const hospital = { hospital_name: 'AIIMS Trauma Centre', city: 'Delhi', contact_number: '98765 43210', latitude: '28.567200', longitude: '77.210000', is_verified: true };
const hospitalToken = '410dcab5-0440-4787-a556-2d1a72651973';
const trackingToken = '7490af64-2df9-438f-a6f5-29be3f680d69';
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
    const dispatch = mock.method(network, 'dispatchRequest', async () => { throw new Error('must not be called'); });
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'O-', units_required: 2, urgency: 'Emergency' }), res);

    assert.equal(res.statusCode, 403);
    assert.equal(dispatch.mock.callCount(), 0);
    assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO blood_requests')));
});

test('a verified hospital request is saved, dispatched, and the hospital token stays server-side', async () => {
    const row = { id: 5, hospital_id: 7, blood_group: 'O-', status: 'Open' };
    const calls = fakeDb([
        ['FROM hospitals', [hospital]],
        ['INSERT INTO blood_requests', [row]],
        ['UPDATE blood_requests SET network_request_id', [{ ...row, network_request_id: 1042, tracking_token: trackingToken, hospital_token: hospitalToken }]],
    ]);
    const dispatch = mock.method(network, 'dispatchRequest', async () => ({
        status: 'dispatched' as const, request_id: 1042, tracking_token: trackingToken, hospital_token: hospitalToken,
        compatible_donors: 6, donors_alerted: 2, donors_on_standby: 4, escalation_minutes: 10,
    }));
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'O-', units_required: 2, urgency: 'Emergency', patient_ref: 'ICU-7' }), res);

    assert.equal(res.statusCode, 201);
    const sent = dispatch.mock.calls[0]!.arguments[0] as any;
    assert.equal(sent.hospital_name, 'AIIMS Trauma Centre');
    assert.equal(sent.hospital_city, 'Delhi');
    assert.equal(sent.hospital_contact, '+919876543210');
    assert.equal(sent.latitude, 28.5672);
    assert.equal(sent.patient_ref, 'ICU-7');

    const update = calls.find((c) => c.sql.includes('SET network_request_id'))!;
    assert.deepEqual(update.params, [1042, trackingToken, hospitalToken, 'Open', 5]);
    assert.equal(res.body.network.donors_alerted, 2);
    assert.doesNotMatch(JSON.stringify(res.body), new RegExp(hospitalToken));
});

test('a request with no compatible donor in range is saved as exhausted', async () => {
    const calls = fakeDb([['FROM hospitals', [hospital]], ['INSERT INTO blood_requests', [{ id: 8 }]], ['SET network_request_id', [{ id: 8, status: 'Exhausted' }]]]);
    mock.method(network, 'dispatchRequest', async () => ({
        status: 'no_compatible_donors' as const, request_id: 1043, tracking_token: trackingToken, hospital_token: hospitalToken,
        compatible_donors: 0, donors_alerted: 0, donors_on_standby: 0, escalation_minutes: null,
    }));
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'AB-', units_required: 1, urgency: 'Urgent' }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(calls.find((c) => c.sql.includes('SET network_request_id'))!.params[3], 'Exhausted');
});

test('a request the network cannot take is still saved, with a warning for the hospital', async () => {
    mock.method(console, 'error', () => { });
    const calls = fakeDb([['FROM hospitals', [hospital]], ['INSERT INTO blood_requests', [{ id: 6 }]]]);
    mock.method(network, 'dispatchRequest', async () => { throw new NetworkError('Units required must be a whole number from 1 to 20', 400); });
    const res = fakeRes();
    await createHospitalRequest(req({ blood_group: 'A+', units_required: 50, urgency: 'Normal' }), res);

    assert.equal(res.statusCode, 201);
    assert.match(res.body.warning, /whole number from 1 to 20/);
    assert.ok(calls.some((c) => c.sql.includes('SET network_error')));
});

test('the request list merges live progress, syncs status and records confirmed donations', async () => {
    const calls = fakeDb([
        ['FROM blood_requests', [{ id: 5, status: 'Open', network_request_id: 1042, hospital_token: hospitalToken, tracking_token: trackingToken }]],
    ]);
    const portal = mock.method(network, 'hospitalPortal', async () => [{
        request_id: 1042, found: true, status: 'Completed',
        donors: [{ match_id: 10011, name: 'Rohan', phone: '+919876500000', blood_group: 'O-', distance_km: 4.2, status: 'donated' as const, responded_at: '2026-09-29T10:00:00Z', donated_url: null, no_show_url: null }],
    }]);
    const res = fakeRes();
    await getHospitalRequests(req(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(portal.mock.calls[0]!.arguments[0], [{ request_id: 1042, hospital_token: hospitalToken }]);
    const [first] = res.body.requests;
    assert.equal(first.status, 'Completed');
    assert.equal(first.live.donors[0].name, 'Rohan');
    assert.equal(first.hospital_token, undefined);
    assert.ok(calls.some((c) => c.sql.includes('UPDATE blood_requests SET status') && c.params[0] === 'Completed'));
    const donation = calls.find((c) => c.sql.includes('INSERT INTO donations'))!;
    assert.deepEqual(donation.params, ['+919876500000', 7, '2026-09-29T10:00:00Z', 10011]);
});

test('the request list still loads when the network is down', async () => {
    mock.method(console, 'error', () => { });
    fakeDb([['FROM blood_requests', [{ id: 5, status: 'Open', network_request_id: 1042, hospital_token: hospitalToken }]]]);
    mock.method(network, 'hospitalPortal', async () => { throw new Error('database timeout'); });
    const res = fakeRes();
    await getHospitalRequests(req(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requests[0].live, null);
    assert.match(res.body.network_error, /unavailable/);
});

