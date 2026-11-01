import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import './helpers';
import * as db from '../src/config/db';
import { answerWaitsForWork, background, keepWorkInRequest } from '../src/utils/background';
import { onHosting, trustProxySetting } from '../src/utils/platform';
import { pointTimerAtThisApi } from '../src/config/initDb';

afterEach(() => mock.restoreAll());

test('Vercel and Cloud Run count as hosting; a developer machine does not', () => {
    assert.equal(onHosting({}), false);
    assert.equal(onHosting({ VERCEL: '1' }), true);
    assert.equal(onHosting({ K_SERVICE: 'lifelink-api' }), true);
    assert.equal(answerWaitsForWork({ VERCEL: '1' }), false, 'Vercel keeps work running with waitUntil');
    assert.equal(answerWaitsForWork({ K_SERVICE: 'lifelink-api' }), true, 'Cloud Run stops the CPU after the answer');
});

test('another host (Antideploy) counts as hosting when TRUST_PROXY says how to find the visitor', () => {
    assert.equal(onHosting({ TRUST_PROXY: 'cloudflare' }), true);
    assert.equal(onHosting({ TRUST_PROXY: ' Cloudflare ' }), true);
    assert.equal(onHosting({ TRUST_PROXY: '1' }), true);
    assert.equal(onHosting({ TRUST_PROXY: ' 2 ' }), true);
    for (const bad of ['', '0', '6', '-1', '1.5', 'true', 'yes']) {
        assert.equal(onHosting({ TRUST_PROXY: bad }), false, `TRUST_PROXY=${bad}`);
    }
    assert.equal(trustProxySetting({}), 1);
    assert.equal(trustProxySetting({ VERCEL: '1' }), 1);
    assert.equal(trustProxySetting({ TRUST_PROXY: '2' }), 2);
    assert.equal(trustProxySetting({ TRUST_PROXY: 'true' }), 1, 'never trust every proxy: visitors could forge their address');
    assert.equal(answerWaitsForWork({ TRUST_PROXY: 'cloudflare' }), true, 'off Vercel, answers wait for their work');
});

/** req.ip for a request from this machine carrying this X-Forwarded-For, under a trust proxy setting. */
const visitorFor = async (trust: number | string[], forwardedFor: string) => {
    const app = express();
    app.set('trust proxy', trust);
    app.get('/ip', (req, res) => { res.json({ ip: req.ip }); });
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/ip`, { headers: { 'x-forwarded-for': forwardedFor } });
        return ((await res.json()) as { ip: string }).ip;
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
};

test('with N proxy hops trusted, the visitor is the address N steps from the end of X-Forwarded-For', async () => {
    // A forged first entry, then the visitor as the edge proxy saw them, then the edge itself
    assert.equal(await visitorFor(trustProxySetting({ TRUST_PROXY: '2' }), '203.0.113.9, 198.51.100.7, 10.0.0.2'), '198.51.100.7');
});

test('behind Cloudflare and a private proxy, the visitor is found and cannot be forged', async () => {
    const trust = trustProxySetting({ TRUST_PROXY: 'cloudflare' });
    assert.ok(Array.isArray(trust) && trust.includes('uniquelocal') && trust.includes('104.16.0.0/13') && trust.includes('2606:4700::/32'));
    // Through Cloudflare: the visitor, whatever they wrote in front of their address
    assert.equal(await visitorFor(trust, '198.51.100.7, 104.16.1.1'), '198.51.100.7');
    assert.equal(await visitorFor(trust, '203.0.113.9, 198.51.100.7, 2606:4700::1'), '198.51.100.7');
    // Straight to the host, skipping Cloudflare: the caller, even one who writes a Cloudflare address
    assert.equal(await visitorFor(trust, '203.0.113.9, 192.0.2.50'), '192.0.2.50');
    assert.equal(await visitorFor(trust, '198.51.100.7, 104.16.1.1, 192.0.2.50'), '192.0.2.50');
});

test('off Vercel, an answer waits for the work it started (an email), then goes out', async () => {
    const app = express();
    app.use(keepWorkInRequest);
    const events: string[] = [];
    app.get('/send', (_req, res) => {
        background(new Promise((resolve) => setTimeout(() => { events.push('email sent'); resolve(null); }, 150)));
        res.json({ ok: true });
    });
    app.get('/plain', (_req, res) => { res.json({ ok: true }); });
    app.get('/failing', (_req, res) => {
        background(Promise.reject(new Error('SMTP down')));
        res.json({ ok: true });
    });
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const errors = mock.method(console, 'error', () => { });
    try {
        const started = Date.now();
        const res = await fetch(`${base}/send`);
        events.push('answer received');
        assert.deepEqual(await res.json(), { ok: true });
        assert.deepEqual(events, ['email sent', 'answer received']);
        assert.ok(Date.now() - started >= 140);

        const quick = Date.now();
        assert.equal((await fetch(`${base}/plain`)).status, 200);
        assert.ok(Date.now() - quick < 140, 'no work, no wait');

        assert.equal((await fetch(`${base}/failing`)).status, 200, 'failed work is logged, the answer still goes out');
        assert.match(String(errors.mock.calls[0]?.arguments[1] ?? errors.mock.calls[0]?.arguments[0]), /SMTP down/);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('the timer is pointed only at an https /network/tick address, and only when one is set', async () => {
    const calls: unknown[][] = [];
    mock.method(db.default, 'query', async (...args: unknown[]) => { calls.push(args); return { rows: [] }; });
    const errors = mock.method(console, 'error', () => { });

    await pointTimerAtThisApi(undefined);
    await pointTimerAtThisApi('');
    assert.equal(calls.length, 0, 'a developer machine leaves the timer alone');

    await pointTimerAtThisApi('http://localhost:5000/network/tick');
    await pointTimerAtThisApi('https://evil.example/steal');
    assert.equal(calls.length, 0);
    assert.equal(errors.mock.callCount(), 2);

    await pointTimerAtThisApi('https://lifelink-api-123456789.asia-south1.run.app/network/tick');
    assert.equal(calls.length, 1);
    assert.match(String(calls[0]![0]), /'network_tick_url'/);
    assert.deepEqual(calls[0]![1], ['https://lifelink-api-123456789.asia-south1.run.app/network/tick']);
});
