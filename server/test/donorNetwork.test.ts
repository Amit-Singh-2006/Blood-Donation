import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import * as network from '../src/services/donorNetwork';
import * as engine from '../src/network/engine';
import { getNetworkStatus, updateNetworkPreferences } from '../src/controllers/donorController';
import { enrolDonor, toE164 } from '../src/services/donorNetwork';
import { networkPreferencesSchema } from '../src/schemas/donorSchemas';

afterEach(() => mock.restoreAll());

const donorRow = { name: 'Riya Sharma', phone: '98765 43210', blood_group: 'O-', city: 'Delhi', gender: 'female' };
const view = { registered: true, donor: { available: true }, alerts: [], history: [] };
const req = (body?: unknown) => ({ user: { id: 7, role: 'donor' }, body } as any);

test('toE164 accepts international numbers and treats bare 10-digit numbers as Indian', () => {
    // An NRI donor registering with a UAE mobile keeps their own country code
    assert.equal(toE164('+971 50 123 4567'), '+971501234567');
    assert.equal(toE164('98765 43210'), '+919876543210');
    assert.equal(toE164('09876543210'), '+919876543210');
    assert.equal(toE164('919876543210'), '+919876543210');
    assert.equal(toE164('12345'), null);
    assert.equal(toE164(null), null);
});

test('GET /donor/network returns the donor view for the signed-in donor\'s own phone', async () => {
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    const portal = mock.method(network, 'donorPortal', async () => ({ status: 200, data: view }));
    const res = fakeRes();
    await getNetworkStatus(req(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, view);
    assert.deepEqual(portal.mock.calls[0]!.arguments, ['+919876543210', undefined, 7], 'looked up for this account');
});

test('a phone linked to another account never shows that donor\'s alerts', async () => {
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    mock.method(network, 'donorPortal', async () => ({ status: 409, data: { registered: false, message: engine.PHONE_TAKEN } }));
    const res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { message: engine.PHONE_TAKEN });

    // Enrolling with it fails the same way, and changes nothing
    mock.restoreAll();
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    mock.method(network, 'donorPortal', async () => ({ status: 404, data: { registered: false } }));
    mock.method(engine, 'upsertDonor', async () => ({ status: 409, data: { status: 'rejected' } }));
    const enrol = fakeRes();
    await updateNetworkPreferences(req({ available: false }), enrol);
    assert.equal(enrol.statusCode, 409);
    assert.equal(enrol.body.message, engine.PHONE_TAKEN);
});

test('registering passes the account so a phone already linked elsewhere is refused', async () => {
    const upsert = mock.method(engine, 'upsertDonor', async () => ({ status: 409, data: { status: 'rejected' } }));
    await assert.rejects(
        network.registerDonor({ name: 'Riya', phone: '+919876543210', blood_group: 'O-', city: 'Delhi' }, {}, 42),
        (err: any) => err instanceof network.NetworkError && err.status === 409,
    );
    assert.equal(upsert.mock.calls[0]!.arguments[1], 42);
});

test('a donor missing from the network is enrolled, keeping the change they asked for', async () => {
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    const answers = [{ status: 404, data: { registered: false } }, { status: 200, data: view }];
    const portal = mock.method(network, 'donorPortal', async () => answers.shift()!);
    const register = mock.method(network, 'registerDonor', async () => ({ status: 'registered' }));
    const res = fakeRes();
    await updateNetworkPreferences(req({ preferred_channel: 'whatsapp' }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(portal.mock.callCount(), 2);
    const [profile, change] = register.mock.calls[0]!.arguments as any[];
    assert.equal(profile.phone, '+919876543210');
    assert.equal(profile.blood_group, 'O-');
    assert.deepEqual(change, { preferred_channel: 'whatsapp' });
});

test('network failures answer 502 without leaking the error', async () => {
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    mock.method(console, 'error', () => { });
    mock.method(network, 'donorPortal', async () => { throw new Error('connect ECONNREFUSED 10.0.0.5:6543'); });
    const res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED/);
});

test('donors without a usable phone are told to add one', async () => {
    mock.method(db, 'query', async () => ({ rows: [{ ...donorRow, phone: '123' }] }));
    const portal = mock.method(network, 'donorPortal', async () => ({ status: 200, data: view }));
    const res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 400);
    assert.equal(portal.mock.callCount(), 0);
});

test('sign-up enrolment never throws, even when the network is down', async () => {
    mock.method(console, 'error', () => { });
    mock.method(engine, 'upsertDonor', async () => { throw new Error('database unavailable'); });
    await assert.doesNotReject(enrolDonor({ name: 'Riya', phone: '9876543210', blood_group: 'O-', city: 'Delhi' }));
});

test('registering sends the profile with availability on and SMS alerts by default', async () => {
    const upsert = mock.method(engine, 'upsertDonor', async () => ({ status: 201, data: { status: 'registered' } }));
    await network.registerDonor({ name: 'Riya', phone: '+919876543210', blood_group: 'O-', city: 'Delhi', gender: 'female' });
    assert.deepEqual(upsert.mock.calls[0]!.arguments[0], {
        name: 'Riya', phone: '+919876543210', blood_group: 'O-', city: 'Delhi', gender: 'female', available: true, preferred_channel: 'sms',
    });

    upsert.mock.mockImplementation(async () => ({ status: 400, data: { status: 'rejected', errors: [] } }));
    await assert.rejects(network.registerDonor({ name: 'R', phone: '+919876543210', blood_group: 'O-', city: 'Delhi' }), /rejected/);
});

test('preference updates must change something and use a supported channel', () => {
    assert.ok(networkPreferencesSchema.safeParse({ available: false }).success);
    assert.ok(networkPreferencesSchema.safeParse({ preferred_channel: 'whatsapp' }).success);
    assert.equal(networkPreferencesSchema.safeParse({}).success, false);
    assert.equal(networkPreferencesSchema.safeParse({ preferred_channel: 'push' }).success, false);
});
