/**
 * LifeLink's outgoing messages: SMS through Twilio, WhatsApp through Meta's
 * Cloud API and email over SMTP (a Gmail app password works). A channel is
 * used only when its settings are present; in-app alerts always work.
 *
 * Donor alerts, hospital notes and campaign invitations go through the
 * network_outbox table. They are sent straight away where possible; whatever
 * is left (a slow provider, a big campaign) is sent by the one-minute network
 * tick, which also retries temporary failures.
 */
import nodemailer from 'nodemailer';
import { query } from '../config/db';

export type SendResult =
    | { status: 'sent'; id?: string | undefined }
    | { status: 'failed'; error: string; retry: boolean }
    | { status: 'skipped'; error: string };

const env = (key: string) => (process.env[key] ?? '').trim();
const TIMEOUT_MS = 10000;

/** Which channels have their settings (never the values themselves). */
export const messagingStatus = () => ({
    sms: !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM')),
    whatsapp: !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID')),
    email: !!(env('SMTP_USER') && env('SMTP_PASS')),
});

const failure = (error: string, retry: boolean): SendResult => ({ status: 'failed', error: error.slice(0, 500), retry });

/** SMS through Twilio. TWILIO_FROM is the sender number, or a Messaging Service SID (MG…). */
export const sendSms = async (to: string, body: string): Promise<SendResult> => {
    const sid = env('TWILIO_ACCOUNT_SID');
    const token = env('TWILIO_AUTH_TOKEN');
    const from = env('TWILIO_FROM');
    if (!sid || !token || !from) return { status: 'skipped', error: 'SMS is not set up' };
    try {
        const form = new URLSearchParams({ To: to, Body: body });
        form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data: any = await res.json().catch(() => ({}));
        if (res.ok) return { status: 'sent', id: data.sid };
        return failure(`Twilio ${res.status}${data.code ? ` (${data.code})` : ''}: ${data.message ?? 'error'}`, res.status >= 500 || res.status === 429);
    } catch (err: any) {
        return failure('Twilio could not be reached: ' + (err?.message ?? err), true);
    }
};

const whatsApp = async (message: object): Promise<SendResult> => {
    const token = env('WHATSAPP_TOKEN');
    const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) return { status: 'skipped', error: 'WhatsApp is not set up' };
    const version = env('WHATSAPP_API_VERSION') || 'v23.0';
    try {
        const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', ...message }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data: any = await res.json().catch(() => ({}));
        if (res.ok) return { status: 'sent', id: data.messages?.[0]?.id };
        const e = data.error ?? {};
        return failure(`WhatsApp ${res.status}${e.code ? ` (${e.code})` : ''}: ${e.message ?? 'error'}`, res.status >= 500 || res.status === 429);
    } catch (err: any) {
        return failure('WhatsApp could not be reached: ' + (err?.message ?? err), true);
    }
};

const waNumber = (phone: string) => phone.replace(/\D/g, '');

/** An approved WhatsApp template ("name|language"), e.g. lifelink_blood_request|en. */
export const sendWhatsAppTemplate = (to: string, template: string, params: string[]) => {
    const [name, language = 'en'] = template.split('|');
    return whatsApp({
        to: waNumber(to),
        type: 'template',
        template: {
            name,
            language: { code: language },
            components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [],
        },
    });
};

/** Free text: WhatsApp delivers it only within 24 hours of the person's last message to LifeLink. */
export const sendWhatsAppText = (to: string, body: string) =>
    whatsApp({ to: waNumber(to), type: 'text', text: { preview_url: true, body } });

let mailer: { key: string; transport: ReturnType<typeof nodemailer.createTransport> } | null = null;
const transport = () => {
    const port = Number(env('SMTP_PORT')) || 465;
    const host = env('SMTP_HOST') || 'smtp.gmail.com';
    // Gmail shows app passwords in groups of four; the spaces are not part of it
    const pass = env('SMTP_PASS').replace(/\s+/g, '');
    const key = [host, port, env('SMTP_USER'), pass].join('|');
    if (mailer?.key !== key) {
        mailer = {
            key,
            transport: nodemailer.createTransport({
                host, port, secure: port === 465,
                auth: { user: env('SMTP_USER'), pass },
                connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: 2 * TIMEOUT_MS,
            }),
        };
    }
    return mailer.transport;
};

/** A plain-text copy of an HTML email, for mail apps (and spam filters) that want one. */
export const plainText = (html: string) => html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li)>/gi, '\n\n')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export const sendEmail = async (to: string, subject: string, html: string): Promise<SendResult> => {
    if (!env('SMTP_USER') || !env('SMTP_PASS')) return { status: 'skipped', error: 'Email is not set up' };
    try {
        const info = await transport().sendMail({
            from: env('EMAIL_FROM') || `LifeLink <${env('SMTP_USER')}>`,
            to, subject, html, text: plainText(html),
        });
        return { status: 'sent', id: info.messageId };
    } catch (err: any) {
        // 5xx answers (bad password, unknown mailbox) will not fix themselves
        const code = Number(err?.responseCode) || 0;
        return failure('Email: ' + (err?.message ?? err), !(code >= 500 && code < 600));
    }
};

// ── Outbox ────────────────────────────────────────────────────────────────

export type OutboxPayload =
    | { text: string }
    | { template: string; params: string[] }
    | { subject: string; html: string };

export interface OutboxMessage {
    channel: 'sms' | 'whatsapp' | 'email';
    recipient: string;
    payload: OutboxPayload;
    /** donor_alert, hospital_note or campaign */
    purpose: string;
    ref_id?: number | null;
}

interface Queryable {
    query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
}

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 6;

/** Queues messages, inside the caller's transaction when one is given. */
export const enqueueMessages = async (messages: OutboxMessage[], db: Queryable = { query }): Promise<number[]> => {
    if (!messages.length) return [];
    const { rows } = await db.query(
        `INSERT INTO network_outbox (channel, recipient, payload, purpose, ref_id)
         SELECT channel, recipient, payload, purpose, ref_id
         FROM jsonb_to_recordset($1::jsonb) AS m(channel text, recipient text, payload jsonb, purpose text, ref_id integer)
         RETURNING id`,
        [JSON.stringify(messages.map((m) => ({ ...m, ref_id: m.ref_id ?? null })))]
    );
    return rows.map((r: any) => r.id);
};

const send = (row: { channel: string; recipient: string; payload: any }): Promise<SendResult> => {
    const p = row.payload ?? {};
    if (row.channel === 'sms') return sendSms(row.recipient, String(p.text ?? ''));
    if (row.channel === 'whatsapp') {
        return p.template ? sendWhatsAppTemplate(row.recipient, p.template, Array.isArray(p.params) ? p.params.map(String) : []) : sendWhatsAppText(row.recipient, String(p.text ?? ''));
    }
    if (row.channel === 'email') return sendEmail(row.recipient, String(p.subject ?? ''), String(p.html ?? ''));
    return Promise.resolve({ status: 'skipped', error: `Unknown channel ${row.channel}` });
};

/**
 * Sends due messages from the outbox: the given ones, or any that are due.
 * Each claimed message is leased for two minutes, so a run that is cut short
 * leaves it for the next one. Temporary failures are retried up to 3 times.
 */
export const deliverMessages = async ({ ids, limit = 60, budgetMs = 8000 }: { ids?: number[]; limit?: number; budgetMs?: number } = {}) => {
    const started = Date.now();
    const counts = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
    if (ids && !ids.length) return counts;
    let claimedTotal = 0;
    while (claimedTotal < limit && Date.now() - started < budgetMs) {
        const { rows } = await query(
            `UPDATE network_outbox SET attempts = attempts + 1, next_attempt_at = now() + interval '2 minutes'
             WHERE id IN (
                 SELECT id FROM network_outbox
                 WHERE status = 'pending' AND next_attempt_at <= now() AND ($2::int[] IS NULL OR id = ANY($2::int[]))
                 ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
             RETURNING id, channel, recipient, payload, attempts`,
            [Math.min(CONCURRENCY * 2, limit - claimedTotal), ids ?? null]
        );
        if (!rows.length) break;
        claimedTotal += rows.length;

        let next = 0;
        const worker = async () => {
            while (next < rows.length) {
                const row = rows[next++];
                const result = await send(row);
                if (result.status === 'failed' && result.retry && row.attempts < MAX_ATTEMPTS) {
                    counts.retrying++;
                    await query(
                        `UPDATE network_outbox SET last_error = $2, next_attempt_at = now() + make_interval(mins => $3) WHERE id = $1`,
                        [row.id, result.error, row.attempts * 2]
                    );
                    continue;
                }
                counts[result.status]++;
                await query(
                    `UPDATE network_outbox SET status = $2::text, last_error = $3, provider_id = $4, sent_at = CASE WHEN $2::text = 'sent' THEN now() END WHERE id = $1`,
                    [row.id, result.status, result.status === 'sent' ? null : result.error, result.status === 'sent' ? result.id ?? null : null]
                );
            }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
    }
    return counts;
};

/** Pending or failed messages lately, for the admin's system status. */
export const outboxSummary = async () => {
    const { rows } = await query(
        `SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
                count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '1 day')::int AS failed_24h,
                count(*) FILTER (WHERE status = 'sent' AND created_at > now() - interval '1 day')::int AS sent_24h
         FROM network_outbox`
    );
    return rows[0] ?? { pending: 0, failed_24h: 0, sent_24h: 0 };
};
