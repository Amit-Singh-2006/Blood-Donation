import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { getNetworkStatus, updateNetworkPreferences } from '../src/controllers/donorController';
import { enrolDonor, toE164 } from '../src/services/donorNetwork';
import { networkPreferencesSchema } from '../src/schemas/donorSchemas';

afterEach(() => {
    mock.restoreAll();
    delete process.env.N8N_WEBHOOK_KEY;
});

const donorRow = { name: 'Riya Sharma', phone: '98765 43210', blood_group: 'O-', city: 'Delhi', gender: 'female' };
const view = { registered: true, donor: { available: true }, alerts: [], history: [] };
const req = (body?: unknown) => ({ user: { id: 7, role: 'donor' }, body } as any);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** Answers each network call in order and records what was sent. */
const fakeNetwork = (...responses: Response[]) => mock.method(globalThis, 'fetch', async () => responses.shift()!);
const sent = (fetchMock: ReturnType<typeof fakeNetwork>, i: number) => {
    const [url, init] = fetchMock.mock.calls[i]!.arguments as [string, RequestInit];
    return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
};

test('toE164 accepts international numbers and treats bare 10-digit numbers as Indian', () => {
    assert.equal(toE164('+14155550100'), '+14155550100');
    assert.equal(toE164('98765 43210'), '+919876543210');
    assert.equal(toE164('09876543210'), '+919876543210');
    assert.equal(toE164('919876543210'), '+919876543210');
    assert.equal(toE164('12345'), null);
    assert.equal(toE164(null), null);
});

test('GET /donor/network returns the donor view, sending the key from the server only', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    const fetchMock = fakeNetwork(json(200, view));
    const res = fakeRes();
    await getNetworkStatus(req(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, view);
    const call = sent(fetchMock, 0);
    assert.match(call.url, /\/donor-portal$/);
    assert.equal(call.headers['X-LifeLink-Key'], 'server-key');
    assert.deepEqual(call.body, { phone: '+919876543210', action: 'status' });
});

test('a donor missing from the network is enrolled, keeping the change they asked for', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    const fetchMock = fakeNetwork(json(404, { registered: false }), json(201, { status: 'registered' }), json(200, view));
    const res = fakeRes();
    await updateNetworkPreferences(req({ preferred_channel: 'whatsapp' }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(fetchMock.mock.callCount(), 3);
    const enrol = sent(fetchMock, 1);
    assert.match(enrol.url, /\/donors$/);
    assert.equal(enrol.body.preferred_channel, 'whatsapp');
    assert.equal(enrol.body.available, true);
    assert.equal(enrol.body.phone, '+919876543210');
});

test('network endpoints answer 503 when the key is missing and 502 when n8n fails', async () => {
    mock.method(db, 'query', async () => ({ rows: [donorRow] }));
    mock.method(console, 'error', () => { });
    let res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 503);

    process.env.N8N_WEBHOOK_KEY = 'server-key';
    fakeNetwork(json(500, { message: 'boom' }));
    res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /boom/);
});

test('donors without a usable phone are told to add one', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(db, 'query', async () => ({ rows: [{ ...donorRow, phone: '123' }] }));
    const fetchMock = fakeNetwork();
    const res = fakeRes();
    await getNetworkStatus(req(), res);
    assert.equal(res.statusCode, 400);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('sign-up enrolment never throws, even when the network is down', async () => {
    process.env.N8N_WEBHOOK_KEY = 'server-key';
    mock.method(console, 'error', () => { });
    mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
    await assert.doesNotReject(enrolDonor({ name: 'Riya', phone: '9876543210', blood_group: 'O-', city: 'Delhi' }));
});

test('preference updates must change something and use a supported channel', () => {
    assert.ok(networkPreferencesSchema.safeParse({ available: false }).success);
    assert.ok(networkPreferencesSchema.safeParse({ preferred_channel: 'whatsapp' }).success);
    assert.equal(networkPreferencesSchema.safeParse({}).success, false);
    assert.equal(networkPreferencesSchema.safeParse({ preferred_channel: 'push' }).success, false);
});
