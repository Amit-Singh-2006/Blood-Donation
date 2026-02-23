import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
    .then(() => console.log('Supabase PostgreSQL connected successfully'))
    .catch((err) => console.error('Connection error:', err));

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
