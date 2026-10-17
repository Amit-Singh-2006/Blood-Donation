import { test, mock, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import './helpers';
import app from '../src/app';
import { allowedOrigins, maskEmail } from '../src/middleware/securityMiddleware';
import { campaignSchema } from '../src/schemas/campaignSchemas';

process.env.JWT_SECRET ??= 'test-jwt-secret';

let server: Server;
let base = '';
before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
// Close the server so the test process exits by itself (a forced exit with
// sockets still closing can crash Node on Windows: "UV_HANDLE_CLOSING")
after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});
afterEach(() => mock.restoreAll());

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const session = (role: 'donor' | 'hospital' | 'admin', id = 7) =>
    `ll_${role}=${jwt.sign({ id, email: `${role}@example.com`, role }, process.env.JWT_SECRET as string, { expiresIn: '5m' })}`;
const call = (method: string, path: string, init: { cookie?: string; body?: string; headers?: Record<string, string> } = {}) =>
    fetch(base + path, {
        method,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json', ...(init.cookie ? { Cookie: init.cookie } : {}), ...init.headers },
        ...(init.body !== undefined ? { body: init.body } : {}),
    });

test('old endpoints that leaked hospital tokens, donor phones or let anyone edit records are gone', async () => {
    const gone: [string, string, 'donor' | 'hospital'][] = [
        ['GET', '/donor/matches', 'donor'],
        ['GET', '/donor/impact/1', 'donor'],
        ['GET', '/donor/leaderboard', 'donor'],
        ['GET', '/hospital/potential-donors/1', 'hospital'],
        ['POST', '/hospital/verify-donation', 'hospital'],
        ['PUT', '/user/profile', 'donor'],
    ];
    for (const [method, path, role] of gone) {
        const res = await call(method, path, { cookie: session(role), ...(method === 'GET' ? {} : { body: '{}' }) });
        assert.equal(res.status, 404, `${method} ${path}`);
    }
    // Without a session the leaderboard is no longer public either
    assert.equal((await call('GET', '/donor/leaderboard')).status, 401);
});

test('the assistant needs a signed-in account', async () => {
    // The sign-in check runs before the controller, so Groq is never reached
    const body = JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'Write me a poem' }] });
    const res = await call('POST', '/ai/chat', { body });
    assert.equal(res.status, 401);
});

test('an unreadable request body is refused and never written to the logs', async () => {
    const logged: string[] = [];
    mock.method(console, 'error', (...args: unknown[]) => { logged.push(args.map(String).join(' ')); });
    const res = await call('POST', '/auth/password/forgot', { body: '{"email":"asha@example.com","password":"Sup3r*Secret' });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { message: 'The request body is not valid JSON.' });
    assert.ok(logged.length > 0);
    assert.ok(logged.every((line) => !line.includes('Sup3r') && !line.includes('asha@')), logged.join('\n'));
});

test('on Vercel the API never trusts localhost origins', () => {
    const env = { FRONTEND_URL: 'http://localhost:3000, https://lifelink.example' };
    assert.ok(allowedOrigins(env).has('http://localhost:3000'), 'local development keeps working');
    const live = allowedOrigins({ ...env, VERCEL: '1' });
    assert.deepEqual([...live].sort(), ['https://blood-donation-frontend-delta.vercel.app', 'https://lifelink.example']);
});

test('security logs keep only a hint of the email', () => {
    assert.equal(maskEmail('asha.patil@gmail.com'), 'a***@gmail.com');
    assert.equal(maskEmail('nonsense'), '***');
    assert.equal(maskEmail(undefined), '***');
});

test('campaign map links must be web links', () => {
    const mapUrl = campaignSchema.shape.map_url;
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
        assert.equal(mapUrl.safeParse(bad).success, false, bad);
    }
    assert.ok(mapUrl.safeParse('https://maps.app.goo.gl/abc').success);
    assert.ok(mapUrl.safeParse('').success);
});
