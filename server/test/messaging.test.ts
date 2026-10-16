import { test, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import * as db from '../src/config/db';
import {
    deliverMessages, enqueueMessages, messagingStatus, plainText, sendEmail, sendSms, sendWhatsAppTemplate, sendWhatsAppText,
} from '../src/services/messaging';

const KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION', 'SMTP_USER', 'SMTP_PASS'];
beforeEach(() => { for (const k of KEYS) delete process.env[k]; });
afterEach(() => mock.restoreAll());

const twilio = () => Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret-token', TWILIO_FROM: '+18167938450' });
const whatsapp = () => Object.assign(process.env, { WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_NUMBER_ID: '1172437482609869' });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test('channels without settings are skipped, never attempted', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(200, {}));
    assert.deepEqual(messagingStatus(), { sms: false, whatsapp: false, email: false });
    assert.equal((await sendSms('+915550000001', 'hi')).status, 'skipped');
    assert.equal((await sendWhatsAppText('+915550000001', 'hi')).status, 'skipped');
    assert.equal((await sendEmail('a@example.com', 'Hi', '<p>Hi</p>')).status, 'skipped');
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('SMS goes to Twilio with the account credentials; only temporary failures are retried', async () => {
    twilio();
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(201, { sid: 'SM1' }));
    assert.deepEqual(await sendSms('+915550000001', 'LifeLink: YES https://x/y?a=1&b=2'), { status: 'sent', id: 'SM1' });
    const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    assert.equal((init.headers as any).Authorization, 'Basic ' + Buffer.from('AC123:secret-token').toString('base64'));
    assert.deepEqual(Object.fromEntries(new URLSearchParams(init.body as string)), { To: '+915550000001', Body: 'LifeLink: YES https://x/y?a=1&b=2', From: '+18167938450' });

    fetchMock.mock.mockImplementation(async () => json(400, { code: 21608, message: 'The number is unverified' }));
    assert.deepEqual(await sendSms('+915550000001', 'x'), { status: 'failed', error: 'Twilio 400 (21608): The number is unverified', retry: false });
    fetchMock.mock.mockImplementation(async () => json(503, {}));
    assert.equal(((await sendSms('+915550000001', 'x')) as any).retry, true);
    fetchMock.mock.mockImplementation(async () => { throw new Error('getaddrinfo ENOTFOUND'); });
    assert.equal(((await sendSms('+915550000001', 'x')) as any).retry, true);

    process.env.TWILIO_FROM = 'MG0123';
    fetchMock.mock.mockImplementation(async () => json(201, { sid: 'SM2' }));
    await sendSms('+915550000001', 'x');
    assert.equal(new URLSearchParams(fetchMock.mock.calls.at(-1)!.arguments[1]!.body as string).get('MessagingServiceSid'), 'MG0123');
});

test('WhatsApp alerts use the approved template with its four values', async () => {
    whatsapp();
    const fetchMock = mock.method(globalThis, 'fetch', async () => json(200, { messages: [{ id: 'wamid.1' }] }));
    const result = await sendWhatsAppTemplate('+91 5550000001', 'lifelink_blood_request|en', ['O+', 'Civil Hospital', 'https://y', 'https://n']);
    assert.deepEqual(result, { status: 'sent', id: 'wamid.1' });
    const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(url, 'https://graph.facebook.com/v23.0/1172437482609869/messages');
    assert.equal((init.headers as any).Authorization, 'Bearer wa-token');
    assert.deepEqual(JSON.parse(init.body as string), {
        messaging_product: 'whatsapp', to: '915550000001', type: 'template',
        template: {
            name: 'lifelink_blood_request', language: { code: 'en' },
            components: [{ type: 'body', parameters: ['O+', 'Civil Hospital', 'https://y', 'https://n'].map((text) => ({ type: 'text', text })) }],
        },
    });

    fetchMock.mock.mockImplementation(async () => json(401, { error: { code: 190, message: 'Error validating access token' } }));
    assert.deepEqual(await sendWhatsAppText('+915550000001', 'hi'), { status: 'failed', error: 'WhatsApp 401 (190): Error validating access token', retry: false });
});

test('emails carry a plain-text copy', () => {
    assert.equal(
        plainText('<p>Hi Asha,</p><p>Use <b>482913</b> &amp; go.<br><a href="https://x/y">Register</a></p>'),
        'Hi Asha,\n\nUse 482913 & go.\nRegister (https://x/y)',
    );
});

test('queued messages are inserted in one statement', async () => {
    const queryMock = mock.method(db, 'query', async () => ({ rows: [{ id: 41 }, { id: 42 }] }));
    const ids = await enqueueMessages([
        { channel: 'sms', recipient: '+915550000001', payload: { text: 'a' }, purpose: 'donor_alert', ref_id: 10001 },
        { channel: 'email', recipient: 'a@example.com', payload: { subject: 's', html: 'h' }, purpose: 'campaign' },
    ]);
    assert.deepEqual(ids, [41, 42]);
    assert.equal(queryMock.mock.callCount(), 1);
    const rows = JSON.parse((queryMock.mock.calls[0]!.arguments as any[])[1][0]);
    assert.deepEqual(rows.map((r: any) => r.ref_id), [10001, null]);
    assert.deepEqual(await enqueueMessages([]), []);
});

test('delivery records each outcome: sent, retried later, failed for good, or skipped', async () => {
    twilio();
    const claimed = [
        { id: 1, channel: 'sms', recipient: '+915550000001', payload: { text: 'ok' }, attempts: 1 },
        { id: 2, channel: 'sms', recipient: '+915550000002', payload: { text: 'busy' }, attempts: 1 },
        { id: 3, channel: 'sms', recipient: '+915550000003', payload: { text: 'bad number' }, attempts: 1 },
        { id: 4, channel: 'email', recipient: 'a@example.com', payload: { subject: 's', html: '<p>h</p>' }, attempts: 1 },
    ];
    const updates: { sql: string; params: any[] }[] = [];
    let claims = 0;
    mock.method(db, 'query', async (sql: string, params: any[] = []) => {
        if (sql.includes('SET attempts = attempts + 1')) return { rows: claims++ === 0 ? claimed : [] };
        updates.push({ sql, params });
        return { rows: [] };
    });
    mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
        const text = new URLSearchParams(init.body as string).get('Body');
        if (text === 'busy') return json(503, { message: 'Service unavailable' });
        if (text === 'bad number') return json(400, { code: 21211, message: 'Invalid To number' });
        return json(201, { sid: 'SM9' });
    });

    const counts = await deliverMessages({ ids: [1, 2, 3, 4] });
    assert.deepEqual(counts, { sent: 1, failed: 1, skipped: 1, retrying: 1 });
    const byId = (id: number) => updates.find((u) => u.params[0] === id)!;
    assert.deepEqual(byId(1).params, [1, 'sent', null, 'SM9']);
    assert.match(byId(2).sql, /next_attempt_at = now\(\) \+ make_interval/);
    assert.deepEqual(byId(3).params.slice(0, 3), [3, 'failed', 'Twilio 400 (21211): Invalid To number']);
    assert.deepEqual(byId(4).params.slice(0, 3), [4, 'skipped', 'Email is not set up']);
    assert.deepEqual(await deliverMessages({ ids: [] }), { sent: 0, failed: 0, skipped: 0, retrying: 0 });
});
