/**
 * A rate-limit store in Postgres. The default store counts in each serverless
 * instance's memory, so with N instances running, a limit allowed N times as
 * many attempts. This one keeps one count per client in the database for all
 * instances. It guards the limits that matter most (password guessing, sign-up
 * and reset abuse, uploads, the assistant); busy, coarse limits stay in memory.
 *
 * On Vercel and Cloud Run it is always used; elsewhere set RATE_LIMIT_STORE=postgres
 * (local development and tests keep the memory store). If the database cannot answer,
 * requests are let through (passOnStoreError): those routes need the database
 * anyway.
 */
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { query } from '../config/db';
import { onHosting } from '../utils/platform';

const MAX_KEY = 200;

export class PostgresStore implements Store {
    readonly localKeys = false;
    readonly prefix: string;
    private windowMs = 60_000;

    constructor(prefix: string) {
        this.prefix = `${prefix}:`;
    }

    init(options: Options) {
        this.windowMs = options.windowMs;
    }

    private key(key: string) {
        return (this.prefix + key).slice(0, MAX_KEY);
    }

    async get(key: string): Promise<ClientRateLimitInfo | undefined> {
        const row = (await query('SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()', [this.key(key)])).rows[0];
        return row ? { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) } : undefined;
    }

    /** One more hit in the current window, or the first of a new window once it has passed. */
    async increment(key: string): Promise<ClientRateLimitInfo> {
        const row = (await query(
            `INSERT INTO rate_limits (key, hits, reset_at) VALUES ($1, 1, now() + $2::int * interval '1 millisecond')
             ON CONFLICT (key) DO UPDATE SET
                 hits = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
                 reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
             RETURNING hits, reset_at`,
            [this.key(key), this.windowMs]
        )).rows[0];
        if (!row) throw new Error('The rate-limit store did not answer.');
        return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
    }

    async decrement(key: string) {
        await query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1 AND reset_at > now()', [this.key(key)]);
    }

    async resetKey(key: string) {
        await query('DELETE FROM rate_limits WHERE key = $1', [this.key(key)]);
    }
}

export const sharedLimitsEnabled = (env: Record<string, string | undefined> = process.env) =>
    onHosting(env) || env.RATE_LIMIT_STORE === 'postgres';

/** Options for rateLimit(): the shared Postgres store when enabled, otherwise nothing (memory). */
export const sharedLimitStore = (prefix: string): Partial<Pick<Options, 'store' | 'passOnStoreError'>> =>
    sharedLimitsEnabled() ? { store: new PostgresStore(prefix), passOnStoreError: true } : {};
