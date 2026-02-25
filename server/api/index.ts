/**
 * Vercel Serverless Entry Point for the Express Backend
 * 
 * Vercel looks for a default export (or `module.exports`) from files in /api.
 * We import the already-configured Express `app` and export it directly.
 * Vercel's Node.js runtime wraps it into a serverless function automatically.
 */
import app from '../src/app';
import initDb from '../src/config/initDb';

// Initialize DB tables once on cold start (Vercel caches this between invocations)
initDb().catch(console.error);

export default app;
