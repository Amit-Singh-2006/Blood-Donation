/**
 * The donor network's engine: it loads and saves rows around the pure rules
 * in this folder. Writes that must not interleave (dispatch, replies,
 * escalation) run one at a time under a transaction-scoped advisory lock.
 * Messages are queued in the same transaction and sent once it commits.
 *
 * Escalation used to wait inside an n8n execution. Now each request stores
 * next_check_at, and escalateDue() runs the rounds that are due: from the
 * one-minute database timer (POST /network/tick) and whenever someone looks
 * at the request.
 */
import type { PoolClient } from 'pg';
import pool, { query } from '../config/db';
import { background } from '../utils/background';
import { OutboxMessage, deliverMessages, enqueueMessages } from '../services/messaging';
import { CampaignDetails, CampaignRecipient, campaignMessages } from './messages';
import { analyticsPage, replyPage, trackingNotFoundPage, trackingPage } from './pages';
import { Decision, NotificationRow, Writes, decideOutcome, parseLink } from './replies';
import {
    AlertedMatch, NetDonor, NetRequest, composeAlert, matchDonors, minutesUntilNextRound, planEscalation, trackingLink, validateDispatch,
} from './rules';
import { DONOR_COLUMNS, MATCH_COLUMNS, Queryable, REQUEST_COLUMNS, first, toDonor, toMatch, toRequest } from './store';
import { parseUssd, ussdMenu, ussdOutcomeReply } from './ussd';
import {
    NetworkAnalytics, buildDonorView, buildHospitalView, buildTracking, computeAnalytics, parseHospitalPortal, registryReply, validatePortal, validateRegistry,
} from './views';

const DEFAULT_API = 'https://blood-donation-backend-sepia.vercel.app';
const DEFAULT_FRONTEND = 'https://blood-donation-frontend-delta.vercel.app';

/** Public address of the network API, used in every link LifeLink sends. */
export const networkBase = () => `${(process.env.API_PUBLIC_URL || DEFAULT_API).trim().replace(/\/$/, '')}/network`;
/** The website, for links in replies: the first https origin in FRONTEND_URL (a list of allowed origins). */
const frontendUrl = () => {
    const origins = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
    return origins.find((o) => o.startsWith('https://')) ?? origins[0] ?? DEFAULT_FRONTEND;
};
const whatsAppAlertTemplate = () => process.env.WHATSAPP_ALERT_TEMPLATE?.trim() || 'lifelink_blood_request|en';

const NETWORK_LOCK = 724725;

/** Runs `work` in a transaction that holds the network lock. */
const inNetworkTransaction = async <T>(work: (db: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // If this instance is paused mid-way, Postgres ends the transaction and frees the lock
        await client.query("SET LOCAL lock_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
        await client.query('SELECT pg_advisory_xact_lock($1)', [NETWORK_LOCK]);
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    } finally {
        client.release();
    }
};

const insertNotifications = async (db: Queryable, rows: NotificationRow[]) => {
    if (!rows.length) return;
    await db.query(
        `INSERT INTO network_notifications (donor_id, request_id, match_id, title, message, type, channel, recipient,
                                            accept_url, decline_url, confirm_donation_url, no_show_url)
         SELECT donor_id, request_id, match_id, title, message, type, channel, recipient,
                accept_url, decline_url, confirm_donation_url, no_show_url
         FROM jsonb_to_recordset($1::jsonb) AS n(donor_id integer, request_id integer, match_id integer, title text, message text,
              type text, channel text, recipient text, accept_url text, decline_url text, confirm_donation_url text, no_show_url text)`,
        [JSON.stringify(rows)]
    );
};

/** The in-app alert for each newly alerted donor, and the SMS or WhatsApp message to send. */
const alertsFor = (matches: AlertedMatch[]) => {
    const base = networkBase();
    const notifications: NotificationRow[] = [];
    const messages: OutboxMessage[] = [];
    for (const m of matches) {
        const a = composeAlert(base, m);
        notifications.push({
            donor_id: m.donor_id, request_id: m.request_id, match_id: m.id, title: a.title,
            message: `${a.message} YES: ${a.accept_url} NO: ${a.decline_url}`, type: 'blood_request',
            channel: m.channel, recipient: 'donor:' + m.donor_id, accept_url: a.accept_url, decline_url: a.decline_url,
        });
        if (m.channel === 'sms' && m.contact) {
            messages.push({ channel: 'sms', recipient: m.contact, payload: { text: a.sms_text }, purpose: 'donor_alert', ref_id: m.id });
        } else if (m.channel === 'whatsapp' && m.contact) {
            messages.push({ channel: 'whatsapp', recipient: m.contact, payload: { template: whatsAppAlertTemplate(), params: a.whatsapp_params }, purpose: 'donor_alert', ref_id: m.id });
        }
        // Push alerts need a Firebase key, which LifeLink does not have yet; they stay in the app
    }
    return { notifications, messages };
};

const sendNow = async (ids: number[]) => {
    if (!ids.length) return;
    try {
        await deliverMessages({ ids, limit: ids.length });
    } catch (err: any) {
        // Still queued: the network tick sends them
        console.error('Message delivery failed:', err?.message ?? err);
    }
};

// ── Request initiation and first wave ─────────────────────────────────────

/** Raises a request: ranks compatible donors and alerts the first wave straight away. */
export const dispatch = async (body: Record<string, unknown>) => {
    const receivedAt = Date.now();
    const { errors, request } = validateDispatch(body, receivedAt);
    if (!request) return { status: 400, data: { status: 'rejected', errors } as Record<string, any> };

    const base = networkBase();
    let outbox: number[] = [];
    const data = await inNetworkTransaction(async (db) => {
        const saved = toRequest((await db.query(
            `INSERT INTO network_requests (hospital_name, hospital_city, hospital_contact, patient_ref, blood_group, units_required, urgency,
                                           latitude, longitude, required_by, wave_size, escalation_minutes, status_token, hospital_token, next_check_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now() + make_interval(mins => $12))
             RETURNING ${REQUEST_COLUMNS}`,
            [request.hospital_name, request.hospital_city, request.hospital_contact, request.patient_ref, request.blood_group, request.units_required,
                request.urgency, request.latitude, request.longitude, request.required_by, request.wave_size, request.escalation_minutes,
                request.status_token, request.hospital_token]
        )).rows[0]);

        const donors = (await db.query(`SELECT ${DONOR_COLUMNS} FROM network_donors WHERE available = TRUE`)).rows.map(toDonor);
        const { compatible_groups, match_rule, matches } = matchDonors(saved, donors, Date.now());
        const summary = { request_id: saved.id, blood_group: saved.blood_group, compatible_groups, match_rule };
        const tracking_url = trackingLink(base, saved.status_token);

        if (!matches.length) {
            await db.query(
                `UPDATE network_requests SET status = 'Exhausted', closed_reason = 'no_compatible_donors', closed_at = now(), next_check_at = NULL, updated_at = now()
                 WHERE id = $1`, [saved.id]);
            await insertNotifications(db, [{
                donor_id: null, request_id: saved.id, match_id: null, type: 'no_donors', channel: 'in_app', recipient: 'hospital:' + saved.hospital_name,
                title: `No compatible donors for ${saved.blood_group} (${saved.hospital_name})`,
                message: `No available, eligible donors compatible with ${saved.blood_group} were found ${match_rule}. Contact the regional blood bank; the request stays visible on the tracking page.`,
            }]);
            return {
                status: 'no_compatible_donors', ...summary, tracking_url, hospital_token: saved.hospital_token,
                message: 'No available, eligible compatible donors right now. The hospital has been alerted to contact the regional blood bank.',
            };
        }

        const inserted = (await db.query(
            `INSERT INTO network_matches (request_id, donor_id, donor_blood_group, request_blood_group, rank, distance_km, exact_match, status,
                                          response_token, channel, contact, hospital_name, hospital_city, urgency, units_required, notified_at)
             SELECT $1, donor_id, donor_blood_group, request_blood_group, rank, distance_km, exact_match, status,
                    response_token, channel, contact, hospital_name, hospital_city, urgency, units_required, notified_at
             FROM jsonb_to_recordset($2::jsonb) AS m(donor_id integer, donor_blood_group text, request_blood_group text, rank integer,
                  distance_km double precision, exact_match boolean, status text, response_token text, channel text, contact text,
                  hospital_name text, hospital_city text, urgency text, units_required integer, notified_at timestamptz)
             RETURNING ${MATCH_COLUMNS}`,
            [saved.id, JSON.stringify(matches)]
        )).rows.map(toMatch).sort((a, b) => a.rank - b.rank);
        const notified = inserted.filter((m) => m.status === 'notified');
        await db.query('UPDATE network_requests SET compatible_donors = $2, donors_notified = $3, updated_at = now() WHERE id = $1',
            [saved.id, inserted.length, notified.length]);

        const { notifications, messages } = alertsFor(notified);
        await insertNotifications(db, notifications);
        outbox = await enqueueMessages(messages, db);
        return {
            status: 'dispatched',
            ...summary,
            urgency: saved.urgency,
            units_required: saved.units_required,
            matched_in_ms: Date.now() - receivedAt,
            compatible_donors: inserted.length,
            donors_alerted: notified.map((m) => ({ rank: m.rank, blood_group: m.donor_blood_group, distance_km: m.distance_km, channel: m.channel })),
            donors_on_standby: inserted.length - notified.length,
            escalation_minutes: saved.escalation_minutes,
            next_escalation_at: saved.next_check_at,
            tracking_url,
            hospital_token: saved.hospital_token,
        };
    });
    await sendNow(outbox);
    return { status: 201, data: data as Record<string, any> };
};

// ── Auto-escalation ───────────────────────────────────────────────────────

/** One escalation round for request `id`, if it is still due. Returns the messages to send. */
const escalateOne = async (db: PoolClient, id: number): Promise<number[] | null> => {
    const req = first(toRequest, await db.query(`SELECT ${REQUEST_COLUMNS} FROM network_requests WHERE id = $1 AND next_check_at <= now()`, [id]));
    if (!req) return null; // another run got there first
    const matches = (await db.query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE request_id = $1`, [id])).rows.map(toMatch);
    const donorIds = [...new Set(matches.map((m) => m.donor_id).filter((d): d is number => d != null))];
    const donors = new Map<number, NetDonor>(
        (await db.query(`SELECT ${DONOR_COLUMNS} FROM network_donors WHERE id = ANY($1::int[])`, [donorIds])).rows.map((r) => [r.id, toDonor(r)])
    );

    const plan = planEscalation(req, matches, donors, Date.now(), req.escalation_rounds + 1);
    for (const u of plan.updates) {
        await db.query('UPDATE network_matches SET status = $2, notified_at = $3, channel = $4, contact = $5, updated_at = now() WHERE id = $1',
            [u.id, u.status, u.notified_at, u.channel, u.contact]);
    }

    if (plan.action === 'stop') {
        await db.query('UPDATE network_requests SET next_check_at = NULL, updated_at = now() WHERE id = $1', [id]);
    } else if (plan.action === 'exhausted') {
        await db.query(
            `UPDATE network_requests SET status = 'Exhausted', closed_reason = $2, escalation_rounds = $3, closed_at = now(), next_check_at = NULL, updated_at = now()
             WHERE id = $1`, [id, plan.reason, plan.round]);
        await insertNotifications(db, [{
            donor_id: null, request_id: id, match_id: null, type: 'donors_exhausted', channel: 'in_app', recipient: 'hospital:' + req.hospital_name,
            title: `Donor search exhausted: ${req.blood_group} for ${req.hospital_name}`,
            message: `Every compatible donor in range has been alerted without covering all ${req.units_required} unit(s) (${plan.reason}). Contact the regional blood bank; late donor replies will still be recorded.`,
        }]);
    } else {
        await db.query(
            `UPDATE network_requests SET escalation_rounds = $2, donors_notified = $3, next_check_at = now() + make_interval(mins => $4), updated_at = now()
             WHERE id = $1`, [id, plan.round, plan.donors_notified_total, minutesUntilNextRound(req, plan)]);
    }

    const byId = new Map(matches.map((m) => [m.id, m]));
    const alerted = plan.updates
        .filter((u) => u.status === 'notified')
        .map((u) => ({ ...byId.get(u.id)!, channel: u.channel, contact: u.contact }));
    const { notifications, messages } = alertsFor(alerted);
    await insertNotifications(db, notifications);
    return enqueueMessages(messages, db);
};

/** Runs the escalation rounds that are due (all, or only the given requests). Returns how many ran. */
export const escalateDue = async ({ ids, limit = 10, budgetMs = 6000 }: { ids?: number[]; limit?: number; budgetMs?: number } = {}) => {
    if (ids && !ids.length) return 0;
    const started = Date.now();
    const due = (await query(
        `SELECT id FROM network_requests WHERE next_check_at <= now() AND ($1::int[] IS NULL OR id = ANY($1::int[]))
         ORDER BY next_check_at LIMIT $2`, [ids ?? null, limit])).rows.map((r: any) => r.id as number);
    let ran = 0;
    for (const id of due) {
        if (Date.now() - started > budgetMs) break;
        const outbox = await inNetworkTransaction((db) => escalateOne(db, id));
        if (!outbox) continue;
        ran++;
        await sendNow(outbox);
    }
    return ran;
};

/** Keeps a request's escalation on time while people are watching it, even if the timer is late. */
const catchUp = async (ids: number[]) => {
    try {
        await escalateDue({ ids, limit: ids.length, budgetMs: 4000 });
    } catch (err: any) {
        console.error('Escalation catch-up failed:', err?.message ?? err);
    }
};

/** The one-minute tick: due escalation rounds, then any messages still waiting. */
export const tick = async ({ budgetMs = 9000 }: { budgetMs?: number } = {}) => {
    const started = Date.now();
    const escalated = await escalateDue({ limit: 25, budgetMs: budgetMs / 2 });
    const delivered = await deliverMessages({ limit: 60, budgetMs: Math.max(1000, budgetMs - (Date.now() - started)) });
    return { escalated, delivered };
};

// ── Donor and hospital replies ────────────────────────────────────────────

const applyWrites = async (db: PoolClient, w: Writes, promptRecheck: boolean) => {
    for (const u of w.match_updates) {
        await db.query('UPDATE network_matches SET status = $2, responded_at = $3, updated_at = now() WHERE id = $1', [u.id, u.status, u.responded_at]);
    }
    for (const u of w.request_updates) {
        // closed_at keeps the moment the request first closed with this status. A
        // donor dropping out of an open request brings the next round forward.
        await db.query(
            `UPDATE network_requests SET
                 closed_at = CASE WHEN $2::text NOT IN ('Completed', 'Exhausted', 'Cancelled') THEN NULL WHEN status = $2::text THEN closed_at ELSE now() END,
                 next_check_at = CASE WHEN $2::text IN ('Completed', 'Cancelled') THEN NULL
                                      WHEN $8::boolean AND $2::text = 'Open' AND next_check_at IS NOT NULL THEN LEAST(next_check_at, now())
                                      ELSE next_check_at END,
                 status = $2::text, units_confirmed = $3, units_donated = $4, first_accept_at = $5, fulfilled_at = $6, closed_reason = $7, updated_at = now()
             WHERE id = $1`,
            [u.id, u.status, u.units_confirmed, u.units_donated, u.first_accept_at, u.fulfilled_at, u.closed_reason, promptRecheck]
        );
    }
    for (const c of w.donor_commitments) {
        await db.query('UPDATE network_donors SET committed_until = $2, updated_at = now() WHERE id = $1', [c.id, c.committed_until]);
    }
    for (const d of w.donations) {
        await db.query(
            `UPDATE network_donors SET last_donation_date = $2, total_donations = $3, xp_points = $4, committed_until = NULL, updated_at = now() WHERE id = $1`,
            [d.id, d.last_donation_date, d.total_donations, d.xp_points]);
    }
    await insertNotifications(db, w.notifications);
};

/** Applies a one-tap link (donor YES/NO, hospital donated/no-show/cancel). */
export const respond = async (q: Record<string, unknown>): Promise<Decision & { format: 'json' | 'html' }> => {
    const link = parseLink(q);
    const base = networkBase();
    const now = Date.now();
    if (link.kind === 'invalid') {
        return { ...decideOutcome({ link, match: null, req: null, reqMatches: [], donor: null, donorMatches: [], now, base }), format: link.format };
    }

    let outbox: number[] = [];
    const decision = await inNetworkTransaction(async (db) => {
        const match = link.match_id ? first(toMatch, await db.query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE id = $1`, [link.match_id])) : null;
        const requestId = link.request_id || match?.request_id || 0;
        const req = requestId ? first(toRequest, await db.query(`SELECT ${REQUEST_COLUMNS} FROM network_requests WHERE id = $1`, [requestId])) : null;
        const reqMatches = req ? (await db.query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE request_id = $1`, [req.id])).rows.map(toMatch) : [];
        const donor = match?.donor_id ? first(toDonor, await db.query(`SELECT ${DONOR_COLUMNS} FROM network_donors WHERE id = $1`, [match.donor_id])) : null;
        const donorMatches = donor ? (await db.query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE donor_id = $1`, [donor.id])).rows.map(toMatch) : [];

        const d = decideOutcome({ link, match, req, reqMatches, donor, donorMatches, now: Date.now(), base });
        await applyWrites(db, d.writes, ['withdrawn', 'no_show_recorded'].includes(d.outcome));
        outbox = await enqueueMessages(d.writes.hospital_sms.map((s) => ({
            channel: 'sms' as const, recipient: s.to, payload: { text: s.text }, purpose: 'hospital_note', ref_id: req?.id ?? null,
        })), db);
        return d;
    });
    await sendNow(outbox);
    return { ...decision, format: link.format };
};

/** The reply as an HTTP answer: JSON for the app, a page for links opened from SMS or WhatsApp. */
export const replyResponse = (d: Decision & { format: 'json' | 'html' }) => d.format === 'json'
    ? { status: d.httpStatus, contentType: 'application/json', body: JSON.stringify(d.payload) }
    : { status: d.httpStatus, contentType: 'text/html; charset=utf-8', body: replyPage(d, frontendUrl()) };

// ── Donor portal and registry ─────────────────────────────────────────────

const loadDonorByPhone = async (phone: string) => first(toDonor, await query(`SELECT ${DONOR_COLUMNS} FROM network_donors WHERE phone = $1`, [phone]));

export const PHONE_TAKEN = 'This mobile number is already linked to another LifeLink account.';

/**
 * The donor's view (profile, live alerts, history), applying an update first
 * when asked. 404 = not on the network. With `ownerId` (the signed-in website
 * account) an entry belonging to another account is refused (409) and an
 * entry without an account becomes this one's.
 */
export const donorPortal = async (body: Record<string, unknown>, ownerId?: number | null) => {
    const p = validatePortal(body);
    if (p.errors.length || !p.phone) return { status: 400, data: { status: 'rejected', errors: p.errors } as Record<string, any> };

    let donor = await loadDonorByPhone(p.phone);
    if (!donor) return { status: 404, data: { registered: false, message: 'No donor with this phone number is on the LifeLink network yet.' } as Record<string, any> };
    if (ownerId != null && donor.user_id != null && donor.user_id !== ownerId) {
        return { status: 409, data: { registered: false, message: PHONE_TAKEN } as Record<string, any> };
    }
    if (ownerId != null && donor.user_id == null) {
        // An account has one entry: an earlier number of this account lets go of it
        await query('UPDATE network_donors SET user_id = NULL WHERE user_id = $1 AND id <> $2', [ownerId, donor.id]);
        await query('UPDATE network_donors SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [ownerId, donor.id]);
    }
    if (p.action === 'update') {
        donor = first(toDonor, await query(
            `UPDATE network_donors SET available = COALESCE($2, available), preferred_channel = COALESCE($3, preferred_channel), updated_at = now()
             WHERE id = $1 RETURNING ${DONOR_COLUMNS}`, [donor.id, p.available, p.preferred_channel]))!;
    }
    const matches = (await query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE donor_id = $1`, [donor.id])).rows.map(toMatch);
    return { status: 200, data: buildDonorView(donor, matches, Date.now(), networkBase()) as Record<string, any> };
};

/**
 * Creates or updates a donor (keyed by phone), keeping history and XP the
 * caller did not send. An entry that belongs to another website account is
 * never changed: that answers 409.
 */
export const upsertDonor = async (body: Record<string, unknown>, ownerId?: number | null) => {
    const v = validateRegistry(body);
    if (!v.profile) return { status: 400, data: { status: 'rejected', errors: v.errors } as Record<string, any> };
    const p = v.profile;
    // An account has one entry: an earlier number of this account lets go of it
    if (ownerId != null) await query('UPDATE network_donors SET user_id = NULL WHERE user_id = $1 AND phone <> $2', [ownerId, p.phone]);
    const { rows } = await query(
        `INSERT INTO network_donors (name, phone, blood_group, gender, city, latitude, longitude, available, last_donation_date,
                                     total_donations, preferred_channel, fcm_token, source, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 0), $11, $12, 'web', $13)
         ON CONFLICT (phone) DO UPDATE SET
             name = EXCLUDED.name, blood_group = EXCLUDED.blood_group, gender = EXCLUDED.gender, city = EXCLUDED.city,
             latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, available = EXCLUDED.available,
             last_donation_date = COALESCE(EXCLUDED.last_donation_date, network_donors.last_donation_date),
             total_donations = COALESCE($10, network_donors.total_donations),
             preferred_channel = EXCLUDED.preferred_channel,
             fcm_token = COALESCE(EXCLUDED.fcm_token, network_donors.fcm_token),
             user_id = COALESCE(network_donors.user_id, EXCLUDED.user_id),
             updated_at = now()
         WHERE network_donors.user_id IS NULL OR network_donors.user_id = EXCLUDED.user_id
         RETURNING id, to_char(last_donation_date, 'YYYY-MM-DD') AS last_donation_date, (xmax = 0) AS inserted`,
        [p.name, p.phone, p.blood_group, p.gender, p.city, p.latitude, p.longitude, p.available, p.last_donation_date,
            p.total_donations, p.preferred_channel, p.fcm_token, ownerId ?? null]
    );
    const saved = rows[0];
    if (!saved) return { status: 409, data: { status: 'rejected', errors: [{ path: 'phone', message: PHONE_TAKEN }] } as Record<string, any> };
    return { status: saved.inserted ? 201 : 200, data: registryReply(p, saved, saved.inserted, v.warnings) as Record<string, any> };
};

// ── Hospital portal ───────────────────────────────────────────────────────

/** Live progress of a hospital's own requests, with confirmed donors and action links. */
export const hospitalPortal = async (list: unknown) => {
    const wanted = parseHospitalPortal(list);
    if (!wanted.length) return { status: 400, data: { status: 'rejected', message: 'Send requests: [{ request_id, hospital_token }]' } as Record<string, any> };
    const ids = wanted.map((w) => w.request_id);
    await catchUp(ids);

    const requests = new Map((await query(`SELECT ${REQUEST_COLUMNS} FROM network_requests WHERE id = ANY($1::int[])`, [ids])).rows.map((r: any) => [r.id, toRequest(r)]));
    const matches = (await query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE request_id = ANY($1::int[])`, [ids])).rows.map(toMatch);
    const donorIds = [...new Set(matches.filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status)).map((m) => m.donor_id).filter((d): d is number => d != null))];
    const donors = new Map<number, NetDonor>(donorIds.length
        ? (await query(`SELECT ${DONOR_COLUMNS} FROM network_donors WHERE id = ANY($1::int[])`, [donorIds])).rows.map((r: any) => [r.id, toDonor(r)])
        : []);
    const base = networkBase();
    return { status: 200, data: { requests: wanted.map((w) => buildHospitalView(w, requests.get(w.request_id), matches, donors, base)) } as Record<string, any> };
};

// ── Tracking and analytics ────────────────────────────────────────────────

/** The family's tracking view. Only the unguessable tracking token opens it. */
export const tracking = async (q: Record<string, unknown>) => {
    const format = q.format === 'json' ? 'json' : 'html';
    const token = /^[0-9a-f-]{36}$/i.test(String(q.token ?? '')) ? String(q.token).toLowerCase() : null;
    const load = async () => (token ? first(toRequest, await query(`SELECT ${REQUEST_COLUMNS} FROM network_requests WHERE status_token = $1`, [token])) : null);

    let req = await load();
    if (req?.next_check_at && Date.parse(req.next_check_at) <= Date.now()) {
        await catchUp([req.id]);
        req = await load();
    }
    if (!req) {
        return format === 'json'
            ? { status: 404, contentType: 'application/json', body: JSON.stringify({ status: 'not_found', message: 'No blood request matches this tracking link.' }) }
            : { status: 404, contentType: 'text/html; charset=utf-8', body: trackingNotFoundPage() };
    }
    const matches = (await query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE request_id = $1`, [req.id])).rows.map(toMatch);
    const summary = buildTracking(req, matches);
    return format === 'json'
        ? { status: 200, contentType: 'application/json', body: JSON.stringify(summary) }
        : { status: 200, contentType: 'text/html; charset=utf-8', body: trackingPage(req, summary) };
};

let analyticsCache: { at: number; metrics: NetworkAnalytics } | null = null;
const ANALYTICS_CACHE_MS = 30000;

/** Network statistics: JSON by default (the website's pages), ?format=html for a dashboard. */
export const analytics = async (q: Record<string, unknown>) => {
    if (!analyticsCache || Date.now() - analyticsCache.at > ANALYTICS_CACHE_MS) {
        const [requests, matches, donors] = await Promise.all([
            query(`SELECT ${REQUEST_COLUMNS} FROM network_requests`),
            query(`SELECT ${MATCH_COLUMNS} FROM network_matches`),
            query(`SELECT ${DONOR_COLUMNS} FROM network_donors`),
        ]);
        analyticsCache = {
            at: Date.now(),
            metrics: computeAnalytics(requests.rows.map(toRequest), matches.rows.map(toMatch), donors.rows.map(toDonor), Date.now()),
        };
    }
    return q.format === 'html'
        ? { status: 200, contentType: 'text/html; charset=utf-8', body: analyticsPage(analyticsCache.metrics) }
        : { status: 200, contentType: 'application/json', body: JSON.stringify(analyticsCache.metrics) };
};

// ── USSD ──────────────────────────────────────────────────────────────────

/** One USSD callback: answers with the next menu (CON …) or a final message (END …). */
export const ussd = async (body: Record<string, unknown>) => {
    const s = parseUssd(body);
    const donor = s.phone ? await loadDonorByPhone(s.phone) : null;
    const pending = donor
        ? (await query(`SELECT ${MATCH_COLUMNS} FROM network_matches WHERE donor_id = $1 AND status = 'notified'`, [donor.id])).rows.map(toMatch)
        : [];
    const step = ussdMenu(s, donor, pending, Date.now());

    if (step.action === 'register') {
        await query(
            `INSERT INTO network_donors (name, phone, blood_group, gender, city, available, total_donations, preferred_channel, xp_points, source)
             VALUES ('LifeLink donor (USSD)', $1, $2, 'unspecified', $3, TRUE, 0, 'sms', 0, 'ussd')
             ON CONFLICT (phone) DO NOTHING`,
            [step.register.phone, step.register.blood_group, step.register.city]);
    } else if (step.action === 'set_availability') {
        await query('UPDATE network_donors SET available = $2, updated_at = now() WHERE id = $1', [step.availability.id, step.availability.available]);
    } else if (step.action === 'respond') {
        // Same logic as the one-tap links
        const d = await respond({ m: String(step.respond.match_id), t: step.respond.token, a: step.respond.action, format: 'json' });
        return ussdOutcomeReply(d.outcome, step.respond.hospital_name);
    }
    return step.reply;
};

// ── Campaigns ─────────────────────────────────────────────────────────────

/**
 * Invites donors to a blood donation camp by SMS, WhatsApp and email. The
 * messages are queued and sent in the background; the network tick sends any
 * that are left.
 */
export const broadcastCampaign = async ({ campaign_id, campaign, register_url, recipients }: {
    campaign_id?: number | null; campaign: CampaignDetails; register_url: string; recipients: CampaignRecipient[];
}) => {
    const messages: OutboxMessage[] = [];
    for (const m of campaignMessages(campaign, register_url, recipients)) {
        const ref_id = campaign_id ?? null;
        if (m.phone) {
            messages.push({ channel: 'sms', recipient: m.phone, payload: { text: m.sms_text }, purpose: 'campaign', ref_id });
            messages.push({ channel: 'whatsapp', recipient: m.phone, payload: { text: m.sms_text }, purpose: 'campaign', ref_id });
        }
        if (m.email) messages.push({ channel: 'email', recipient: m.email, payload: { subject: m.email_subject, html: m.email_html }, purpose: 'campaign', ref_id });
    }
    const ids = await enqueueMessages(messages);
    background(deliverMessages({ ids, limit: ids.length, budgetMs: 45000 }));
    return { queued: ids.length };
};

/** Whether the database timer that drives escalation is running (Supabase pg_cron). */
export const timerStatus = async (): Promise<boolean> => {
    try {
        const { rows } = await query(`SELECT active FROM cron.job WHERE jobname = 'lifelink-network-tick'`);
        return rows[0]?.active === true;
    } catch {
        return false; // no pg_cron in this database
    }
};
