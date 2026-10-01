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

// Requests wait for the schema check (at most 3 s). Vercel pauses an instance
// once no request is in flight, and a pause in the middle of the check could
// leave tables locked, so it must finish while a request is still open.
const ready = initDb().catch(console.error);
const settled = Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 3000).unref())]);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await settled;
    return app(req as any, res as any);
}
