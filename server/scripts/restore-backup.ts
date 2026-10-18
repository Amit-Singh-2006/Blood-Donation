/**
 * Opens a LifeLink backup made by scripts/backup.ts.
 *
 *   cd server
 *   node -r ts-node/register/transpile-only scripts/restore-backup.ts check <file>
 *     Proves the file opens with your key and that every row loads into the
 *     current schema (temporary tables, thrown away). Changes nothing.
 *
 *   RESTORE_DATABASE_URL=<empty database> node -r ts-node/register/transpile-only scripts/restore-backup.ts restore <file>
 *     Disaster recovery: creates the schema in that EMPTY database (initDb)
 *     and loads every row. It refuses a database that already has data, and
 *     the database in server/.env unless --into-configured-database is given.
 *     Afterwards, point DATABASE_URL (server/.env and Vercel) at it.
 *
 * The key comes from LIFELINK_BACKUP_KEY_FILE, or the default key path.
 */
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { checkRestore, keyFilePath, loadKey, readBackup, restoreRows } from './backupFormat';

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const [mode, file] = process.argv.slice(2);
const usage = 'Usage: restore-backup.ts check <file> | restore <file> (with RESTORE_DATABASE_URL set)';

const connect = (connectionString: string) => {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 20000 });
    pool.on('error', () => { });
    return pool;
};

const summary = (counts: Record<string, number>) => {
    const tables = Object.entries(counts).filter(([, n]) => n > 0);
    return `${tables.reduce((a, [, n]) => a + n, 0)} rows in ${tables.length} tables`;
};

const main = async () => {
    if (!file || !['check', 'restore'].includes(mode ?? '')) throw new Error(usage);
    const { key } = loadKey(keyFilePath(), false);
    const { header } = await readBackup(file, key);
    console.log(`Backup made ${header.created_at} (schema ${header.schema_version ?? 'unknown'}): the file opens and is complete.`);

    if (mode === 'check') {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (server/.env).');
        const pool = connect(process.env.DATABASE_URL);
        const client = await pool.connect();
        try {
            console.log(`Restore check passed: ${summary(await checkRestore(client, file, key))} load into the current schema.`);
        } finally {
            client.release();
            await pool.end();
        }
        return;
    }

    const target = process.env.RESTORE_DATABASE_URL;
    if (!target) throw new Error('Set RESTORE_DATABASE_URL to the empty database to restore into.');
    if (target === process.env.DATABASE_URL && !process.argv.includes('--into-configured-database')) {
        throw new Error('RESTORE_DATABASE_URL is the database in server/.env. Restore into a new, empty database instead.');
    }
    // initDb (and the pool it uses) read DATABASE_URL when first loaded: point it at the target first
    process.env.DATABASE_URL = target;
    const { default: initDb } = require('../src/config/initDb') as typeof import('../src/config/initDb');
    const db = require('../src/config/db') as typeof import('../src/config/db');
    try {
        if (!(await initDb())) throw new Error('Could not create the schema in the target database.');
        const client = await db.pool.connect();
        try {
            console.log(`Restored ${summary(await restoreRows(client, file, key))}.`);
        } finally {
            client.release();
        }
    } finally {
        await db.pool.end();
    }
};

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
