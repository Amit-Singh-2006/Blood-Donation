import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import './helpers';
import * as db from '../src/config/db';
import { answerWaitsForWork, background, keepWorkInRequest } from '../src/utils/background';
import { onHosting } from '../src/utils/platform';
import { pointTimerAtThisApi } from '../src/config/initDb';

afterEach(() => mock.restoreAll());

test('Vercel and Cloud Run count as hosting; a developer machine does not', () => {
    assert.equal(onHosting({}), false);
    assert.equal(onHosting({ VERCEL: '1' }), true);
    assert.equal(onHosting({ K_SERVICE: 'lifelink-api' }), true);
    assert.equal(answerWaitsForWork({ VERCEL: '1' }), false, 'Vercel keeps work running with waitUntil');
    assert.equal(answerWaitsForWork({ K_SERVICE: 'lifelink-api' }), true, 'Cloud Run stops the CPU after the answer');
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
