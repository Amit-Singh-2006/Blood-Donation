/**
 * Encrypted backup of the LifeLink database. Windows Task Scheduler runs it
 * every evening (scripts/schedule-backup.ps1); it can also be run by hand:
 *
 *   cd server
 *   node -r ts-node/register/transpile-only scripts/backup.ts
 *
 * It writes lifelink-<date-time>.llbak into the backup folder (scripts/
 * backupFormat.ts → backupDir), proves the new file restores by loading every
 * row into temporary tables that are then thrown away, keeps the newest
 * LIFELINK_BACKUP_KEEP files (30), and adds a line to backup.log. The key that
 * opens the files lives elsewhere (keyFilePath); keep a copy of it somewhere
 * safe, or the backups cannot be opened.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { BackupWriter, backupDir, checkRestore, keyFilePath, loadKey, writeBackup } from './backupFormat';

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const KEEP = Math.max(1, Number(process.env.LIFELINK_BACKUP_KEEP) || 30);
const FILE_PATTERN = /^lifelink-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.llbak$/;

const dir = backupDir();
const log = (message: string) => {
    const line = `${new Date().toISOString()}  ${message}`;
    console.log(line);
    fs.appendFileSync(path.join(dir, 'backup.log'), line + '\n');
};

/** Keeps the newest KEEP backups; older ones are deleted. */
const rotate = () => {
    const files = fs.readdirSync(dir).filter((f) => FILE_PATTERN.test(f)).sort().reverse();
    for (const old of files.slice(KEEP)) fs.unlinkSync(path.join(dir, old));
    return files.length - Math.min(files.length, KEEP);
};

const main = async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (server/.env).');
    fs.mkdirSync(dir, { recursive: true });
    const keyFile = keyFilePath();
    const { key, created } = loadKey(keyFile, true);
    if (created) {
        log(`Created a new backup key at ${keyFile}. Save a copy in your password manager: without it no backup can be opened.`);
    }

    const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
    const file = path.join(dir, `lifelink-${stamp}.llbak`);
    const started = Date.now();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 20000 });
    pool.on('error', () => { });
    const client = await pool.connect();
    try {
        const writer = new BackupWriter(file, key);
        let counts: Record<string, number>;
        try {
            counts = await writeBackup(client, writer);
        } finally {
            await writer.close().catch(() => { });
        }
        // A backup is only good if it restores
        const loaded = await checkRestore(client, file, key);
        const wrong = Object.entries(counts).filter(([table, n]) => (loaded[table] ?? 0) !== n);
        if (wrong.length) throw new Error(`Restore check failed for ${wrong.map(([t, n]) => `${t} (${loaded[t] ?? 0} of ${n})`).join(', ')}`);

        const rows = Object.values(counts).reduce((a, b) => a + b, 0);
        const size = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
        const removed = rotate();
        log(`OK  ${path.basename(file)}  ${size} MB, ${Object.keys(counts).length} tables, ${rows} rows, restore check passed`
            + `${removed ? `, ${removed} old backup(s) removed` : ''} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    } catch (err) {
        fs.rmSync(file, { force: true });
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
};

main().catch((err) => {
    try {
        fs.mkdirSync(dir, { recursive: true });
        log(`FAILED  ${err instanceof Error ? err.message : String(err)}`);
    } catch {
        console.error('Backup failed:', err);
    }
    process.exitCode = 1;
});
