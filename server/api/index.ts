/**
 * Vercel Serverless Entry Point for the Express Backend
 * 
 * Vercel looks for a default export (or `module.exports`) from files in /api.
 * We import the already-configured Express `app` and export it directly.
 * Vercel's Node.js runtime wraps it into a serverless function automatically.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import app from '../src/app';
import initDb from '../src/config/initDb';

// The schema check runs inside a request, never when the module loads: Vercel can
// pause an instance between loading it and its first request, and a database
// connection opened before that pause timed out, so new tables were never created.
// A failed check is tried again with the next request. Requests wait for it at
// most 8 s; it must finish while a request keeps the instance running, because a
// pause in the middle of a schema change could leave tables locked.
let schemaReady: Promise<boolean> | null = null;
const ensureSchema = (): Promise<boolean> => {
    schemaReady ??= initDb()
        .catch(() => false)
        .then((ok) => {
            if (!ok) schemaReady = null;
            return ok;
        });
    return schemaReady;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await Promise.race([ensureSchema(), new Promise((resolve) => setTimeout(resolve, 8000).unref())]);
    return app(req as any, res as any);
}
