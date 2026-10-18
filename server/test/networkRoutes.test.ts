import { test, mock, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import './helpers';
import app from '../src/app';
import * as engine from '../src/network/engine';
import * as db from '../src/config/db';

let server: Server;
let base = '';
before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
afterEach(() => {
    mock.restoreAll();
    delete process.env.USSD_GATEWAY_KEY;
});

const BROWSER = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const decision = {
    outcome: 'accepted', httpStatus: 200, tone: 'ok' as const, title: 'Thank you, Asha!', message: 'Civil Hospital has been told you are coming.',
    pass: 'LP-ABCD-EFGH', payload: { outcome: 'accepted', title: 'Thank you, Asha!', message: 'x', pass_code: 'LP-ABCD-EFGH', request_status: 'Open', units_required: 2, units_confirmed: 1 },
    writes: { match_updates: [], request_updates: [], donor_commitments: [], donations: [], notifications: [], hospital_sms: [] },
};
const link = '/network/donor-response?m=10001&t=00000000-0000-4000-8000-000000000001&a=accept';

test('link previews and link checkers cannot answer a request on the donor\'s behalf', async () => {
    const respond = mock.method(engine, 'respond', async () => ({ ...decision, format: 'html' as const }));
    for (const ua of ['WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0', 'curl/8.4.0']) {
        const res = await fetch(base + link, { headers: { 'User-Agent': ua } });
        assert.equal(res.status, 403, ua);
    }
    assert.equal((await fetch(base + link, { method: 'HEAD', headers: { 'User-Agent': BROWSER } })).status, 403);
    assert.equal(respond.mock.callCount(), 0);
});

test('a person opening the link gets the reply page; the app gets JSON', async () => {
    const respond = mock.method(engine, 'respond', async (q: any) => ({ ...decision, format: q.format === 'json' ? 'json' as const : 'html' as const }));
    const page = await fetch(base + link, { headers: { 'User-Agent': BROWSER } });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type')!, /^text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(page.headers.get('x-robots-tag')!, /noindex/);
    assert.match(await page.text(), /Thank you, Asha!.*LP-ABCD-EFGH/s);
    assert.deepEqual({ ...respond.mock.calls[0]!.arguments[0] }, { m: '10001', t: '00000000-0000-4000-8000-000000000001', a: 'accept' });

    const api = await fetch(base + link + '&format=json', { headers: { 'User-Agent': BROWSER, Origin: 'http://localhost:5173' } });
    assert.equal(api.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal((await api.json()).pass_code, 'LP-ABCD-EFGH');
});

test('USSD answers only the gateway that knows the key', async () => {
    const ussd = mock.method(engine, 'ussd', async () => 'CON Welcome to LifeLink.');
    const post = (query = '') => fetch(base + '/network/ussd' + query, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ sessionId: 's1', serviceCode: '*384*7#', phoneNumber: '+919876543210', text: '1*2' }),
    });
    assert.equal(await (await post()).text(), 'END LifeLink USSD is not switched on yet.');

    process.env.USSD_GATEWAY_KEY = 'gateway-key-123';
    const wrong = await post('?key=guess');
    assert.equal(wrong.status, 403);
    assert.equal(ussd.mock.callCount(), 0);

    const right = await post('?key=gateway-key-123');
    assert.equal(right.status, 200);
    assert.match(right.headers.get('content-type')!, /^text\/plain/);
    assert.equal(await right.text(), 'CON Welcome to LifeLink.');
    assert.deepEqual(ussd.mock.calls[0]!.arguments[0], { sessionId: 's1', serviceCode: '*384*7#', phoneNumber: '+919876543210', text: '1*2' });
});

test('only the database timer, with its secret, can run a tick', async () => {
    const SECRET = 'a'.repeat(64);
    mock.method(db, 'query', async (sql: string) => ({ rows: sql.includes('app_secrets') ? [{ value: SECRET }] : [], rowCount: 0 }));
    const tick = mock.method(engine, 'tick', async () => ({ escalated: 2, delivered: { sent: 3, failed: 0, skipped: 1, retrying: 0 } }));
    const post = (secret?: string) => fetch(base + '/network/tick', { method: 'POST', headers: secret ? { 'X-LifeLink-Tick': secret } : {} });

    assert.equal((await post()).status, 401, 'no secret');
    assert.equal((await post('b'.repeat(64))).status, 401, 'wrong secret');
    assert.equal((await post('a'.repeat(63))).status, 401, 'too short');
    assert.equal(tick.mock.callCount(), 0);

    const res = await post(SECRET);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { escalated: 2, delivered: { sent: 3, failed: 0, skipped: 1, retrying: 0 } });
});

test('tracking and statistics hide internal errors', async () => {
    mock.method(console, 'error', () => { });
    mock.method(engine, 'tracking', async () => { throw new Error('relation "network_requests" does not exist'); });
    const res = await fetch(base + '/network/request-status?token=00000000-0000-4000-8000-000000000800&format=json');
    assert.equal(res.status, 500);
    assert.doesNotMatch(await res.text(), /relation/);
});
