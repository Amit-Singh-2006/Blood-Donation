import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Older columns are TIMESTAMP (no time zone) written in the database's UTC.
// Read them as UTC too; by default pg uses the server's local zone, so a
// machine on IST showed a request raised 25 minutes ago as "6 h ago".
const TIMESTAMP_WITHOUT_TZ = 1114;
types.setTypeParser(TIMESTAMP_WITHOUT_TZ, (value: string) => new Date(value.replace(' ', 'T') + 'Z'));

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 5,                   // limit concurrent connections for Supabase pooler
    idleTimeoutMillis: 30000, // close idle clients after 30s
    connectionTimeoutMillis: 10000, // fail fast if can't connect in 10s
    keepAlive: true,
});

pool.connect()
    .then(client => { client.release(); }) // silently confirm connection
    .catch((err) => { if (process.env.NODE_ENV !== 'production') console.error('DB connection error:', err.message); });

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
