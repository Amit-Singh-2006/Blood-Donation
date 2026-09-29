import { Request, Response } from 'express';
import { query } from '../config/db';

/**
 * Describes where DATABASE_URL points without revealing it, so a
 * misconfigured deployment can be diagnosed from the outside.
 */
export const describeDatabaseTarget = (url: string | undefined) => {
    if (!url) return { target: 'missing' };
    try {
        const { hostname, port } = new URL(url);
        const target = hostname.endsWith('pooler.supabase.com') ? 'supabase-pooler'
            : hostname.endsWith('.supabase.co') ? 'supabase-direct'
            : 'other';
        return { target, port: port || '5432' };
    } catch {
        // e.g. the value was pasted with quotes or a "DATABASE_URL=" prefix
        return { target: 'unparseable' };
    }
};

// GET /health
export const healthCheck = async (req: Request, res: Response) => {
    const database = describeDatabaseTarget(process.env.DATABASE_URL);
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: { reachable: true, ...database } });
    } catch (err: any) {
        // Only the driver's error code, never its message (it can echo the URL)
        res.status(503).json({ status: 'degraded', database: { reachable: false, ...database, error_code: err?.code ?? 'unknown' } });
    }
};
