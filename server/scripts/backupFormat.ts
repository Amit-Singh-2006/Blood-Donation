/**
 * LifeLink's backup files. A backup holds every row of every table in the
 * public schema, in an order that respects foreign keys, as one JSON object
 * per line (row_to_json, so every value keeps its exact Postgres form). The
 * lines are gzipped, then encrypted with AES-256-GCM.
 *
 * The schema itself is not stored: config/initDb.ts creates it, so a restore
 * runs initDb on an empty database first and then loads the rows.
 *
 * File layout: "LLBK1", the 12-byte IV, the ciphertext, the 16-byte GCM tag.
 * Lines: a header {"@lifelink_backup":1,...}, then per table {"@table":...},
 * its rows, {"@table_end":...,"rows":n}; finally {"@backup_end":true,...}.
 * Rows never collide with these markers: column names never start with "@".
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createGunzip, createGzip } from 'zlib';
import { once } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

export interface Queryable {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

const MAGIC = Buffer.from('LLBK1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FETCH_ROWS = 500;
const INSERT_ROWS = 200;

/** Never written by a restore: initDb creates them, or they are short-lived. */
export const NOT_RESTORED = new Set(['app_schema', 'app_secrets', 'rate_limits']);

/** Where backups go: LIFELINK_BACKUP_DIR, else the OneDrive folder (synced off this PC), else the home folder. */
export const backupDir = () => process.env.LIFELINK_BACKUP_DIR
    || (process.env.OneDrive ? path.join(process.env.OneDrive, 'LifeLink backups') : path.join(os.homedir(), 'lifelink-backups'));

/** The key lives apart from the backups, and is never synced with them. */
export const keyFilePath = () => process.env.LIFELINK_BACKUP_KEY_FILE || path.join(os.homedir(), 'lifelink-private', 'backup-key.txt');

/** The 32-byte key; with `create`, a new one is made the first time (and `created` says so). */
export const loadKey = (file: string, create: boolean): { key: Buffer; created: boolean } => {
    if (fs.existsSync(file)) {
        const key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
        if (key.length !== 32) throw new Error(`${file} does not hold a LifeLink backup key.`);
        return { key, created: false };
    }
    if (!create) throw new Error(`No backup key at ${file}. Put back the copy you saved, or set LIFELINK_BACKUP_KEY_FILE.`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const key = randomBytes(32);
    fs.writeFileSync(file, key.toString('base64') + '\n', { mode: 0o600, flag: 'wx' });
    return { key, created: true };
};

export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Writes one backup file: lines in, gzip, AES-256-GCM, file. */
export class BackupWriter {
    private readonly gzip = createGzip({ level: 9 });
    private readonly finished: Promise<void>;

    constructor(readonly file: string, key: Buffer) {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(MAGIC);
        const out = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 });
        out.write(Buffer.concat([MAGIC, iv]));
        this.gzip.pipe(cipher);
        cipher.on('data', (chunk: Buffer) => out.write(chunk));
        this.finished = new Promise<void>((resolve, reject) => {
            cipher.on('end', () => out.end(cipher.getAuthTag()));
            out.on('finish', () => resolve());
            for (const stream of [this.gzip, cipher, out]) stream.on('error', reject);
        });
    }

    async line(value: unknown) {
        const text = (typeof value === 'string' ? value : JSON.stringify(value)) + '\n';
        if (!this.gzip.write(text)) await once(this.gzip, 'drain');
    }

    async close() {
        this.gzip.end();
        await this.finished;
    }
}

/**
 * The lines of a backup file, in order. It throws if the key is wrong or the
 * file was changed or cut short; the GCM check only completes at the very end,
 * so read the whole file before trusting any of it.
 */
export async function* readBackupLines(file: string, key: Buffer): AsyncGenerator<string> {
    const { size } = fs.statSync(file);
    if (size < MAGIC.length + IV_BYTES + TAG_BYTES) throw new Error(`${file} is too short to be a LifeLink backup.`);
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(MAGIC.length + IV_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    try {
        fs.readSync(fd, head, 0, head.length, 0);
        fs.readSync(fd, tag, 0, TAG_BYTES, size - TAG_BYTES);
    } finally {
        fs.closeSync(fd);
    }
    if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error(`${file} is not a LifeLink backup.`);

    const decipher = createDecipheriv('aes-256-gcm', key, head.subarray(MAGIC.length));
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    const gunzip = createGunzip();
    const input = fs.createReadStream(file, { start: head.length, end: size - TAG_BYTES - 1 });
    // pipe() does not pass errors on: a wrong key or a changed file must end the read
    for (const stream of [input, decipher]) stream.on('error', (err) => gunzip.destroy(err));
    input.pipe(decipher).pipe(gunzip);
    const lines = readline.createInterface({ input: gunzip, crlfDelay: Infinity });
    let failure: unknown = null;
    gunzip.on('error', (err) => { failure = err; lines.close(); });
    try {
        for await (const line of lines) {
            if (failure) break;
            if (line) yield line;
        }
    } catch (err) {
        failure = err;
    }
    if (failure) throw new Error(`Could not open the backup (wrong key, or the file was changed or cut short): ${(failure as Error).message}`);
}

/** Public tables with parents before children, so rows load in foreign-key order. */
export const tableOrder = async (db: Queryable): Promise<string[]> => {
    const tables: string[] = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`))
        .rows.map((r) => r.tablename);
    const edges: { child: string; parent: string }[] = (await db.query(
        `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
         FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`
    )).rows.map((e) => ({ child: e.child.replace(/^public\./, ''), parent: e.parent.replace(/^public\./, '') }));
    const parents = new Map(tables.map((t) => [t, new Set<string>()]));
    for (const { child, parent } of edges) if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child)!.add(parent);
    const order: string[] = [];
    while (order.length < tables.length) {
        const ready = tables.filter((t) => !order.includes(t) && [...parents.get(t)!].every((p) => order.includes(p)));
        // A cycle cannot be ordered: append the rest (restores then need deferred checks)
        order.push(...(ready.length ? ready : tables.filter((t) => !order.includes(t))));
    }
    return order;
};

const tableColumns = async (db: Queryable, table: string): Promise<string[]> => (await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
)).rows.map((r) => r.column_name);

/**
 * Writes every public table into `writer` from one consistent snapshot, and
 * returns the row count of each table.
 */
export const writeBackup = async (client: Queryable, writer: BackupWriter): Promise<Record<string, number>> => {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
        const order = await tableOrder(client);
        const schema = (await client.query('SELECT version FROM app_schema WHERE id = 1')).rows[0]?.version ?? null;
        await writer.line({ '@lifelink_backup': 1, created_at: new Date().toISOString(), schema_version: schema, tables: order });
        const counts: Record<string, number> = {};
        for (const table of order) {
            await writer.line({ '@table': table, columns: await tableColumns(client, table) });
            await client.query(`DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS r FROM public.${ident(table)} t`);
            let rows = 0;
            for (;;) {
                const batch = (await client.query(`FETCH ${FETCH_ROWS} FROM backup_rows`)).rows;
                for (const row of batch) await writer.line(row.r);
                rows += batch.length;
                if (batch.length < FETCH_ROWS) break;
            }
            await client.query('CLOSE backup_rows');
            await writer.line({ '@table_end': table, rows });
            counts[table] = rows;
        }
        await writer.line({ '@backup_end': true, rows: counts });
        await client.query('COMMIT');
        return counts;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    }
};

export interface BackupTable { table: string; columns: string[]; rows: number }

/**
 * Reads a whole backup and checks its structure (every table closed with the
 * right count, the end marker present). Calls `onRows` with batches of row
 * JSON for each table. Returns the header and the tables.
 */
export const readBackup = async (
    file: string, key: Buffer,
    onRows?: (table: BackupTable, rows: string[]) => Promise<void>,
): Promise<{ header: Record<string, any>; tables: BackupTable[] }> => {
    let header: Record<string, any> | null = null;
    let current: BackupTable | null = null;
    let batch: string[] = [];
    let ended = false;
    const tables: BackupTable[] = [];
    const flush = async () => {
        if (current && batch.length && onRows) await onRows(current, batch);
        batch = [];
    };
    for await (const line of readBackupLines(file, key)) {
        if (ended) throw new Error('The backup has data after its end marker.');
        if (!line.startsWith('{"@')) {
            if (!current) throw new Error('The backup has a row outside a table.');
            batch.push(line);
            current.rows++;
            if (batch.length >= INSERT_ROWS) await flush();
            continue;
        }
        const marker = JSON.parse(line);
        if (marker['@lifelink_backup'] !== undefined) {
            if (header) throw new Error('The backup has two headers.');
            if (marker['@lifelink_backup'] !== 1) throw new Error(`Unknown backup format ${marker['@lifelink_backup']}.`);
            header = marker;
        } else if (marker['@table'] !== undefined) {
            if (!header || current) throw new Error('The backup is out of order.');
            current = { table: marker['@table'], columns: marker.columns, rows: 0 };
        } else if (marker['@table_end'] !== undefined) {
            if (!current || marker['@table_end'] !== current.table) throw new Error('The backup is out of order.');
            await flush();
            if (marker.rows !== current.rows) throw new Error(`Table ${current.table}: ${current.rows} rows read, ${marker.rows} expected.`);
            tables.push(current);
            current = null;
        } else if (marker['@backup_end']) {
            if (current) throw new Error('The backup ends inside a table.');
            ended = true;
        }
    }
    if (!header || !ended) throw new Error('The backup is incomplete (no end marker).');
    return { header, tables };
};

/** The columns both the backup and the database have, quoted for SQL. */
const sharedColumns = (backup: BackupTable, current: string[]) => {
    const columns = backup.columns.filter((c) => current.includes(c));
    if (!columns.length) throw new Error(`Table ${backup.table} has no columns in common with the database.`);
    return columns.map(ident).join(', ');
};

/**
 * Proves a backup restores: inside one transaction that is rolled back, loads
 * every row into a temporary copy of its table (same types, defaults, NOT NULL
 * and CHECK rules). Nothing is changed. Returns the rows loaded per table.
 */
export const checkRestore = async (client: Queryable, file: string, key: Buffer): Promise<Record<string, number>> => {
    const loaded: Record<string, number> = {};
    const prepared = new Map<string, { temp: string; columns: string }>();
    await client.query('BEGIN');
    try {
        await readBackup(file, key, async (table, rows) => {
            let target = prepared.get(table.table);
            if (!target) {
                const current = await tableColumns(client, table.table);
                if (!current.length) throw new Error(`Table ${table.table} is in the backup but not in the database.`);
                const temp = `restore_check_${prepared.size}`;
                await client.query(`CREATE TEMP TABLE ${ident(temp)} (LIKE public.${ident(table.table)} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`);
                target = { temp, columns: sharedColumns(table, current) };
                prepared.set(table.table, target);
            }
            const result = await client.query(
                `INSERT INTO pg_temp.${ident(target.temp)} (${target.columns})
                 SELECT ${target.columns} FROM json_populate_recordset(NULL::pg_temp.${ident(target.temp)}, $1::json)`,
                [`[${rows.join(',')}]`]
            ) as { rows: any[]; rowCount?: number | null };
            loaded[table.table] = (loaded[table.table] ?? 0) + (result.rowCount ?? 0);
        });
    } finally {
        await client.query('ROLLBACK').catch(() => { });
    }
    return loaded;
};

/**
 * Loads a backup into a database whose schema initDb has just created and
 * which holds no data yet. One transaction: all of it, or none of it. Serial
 * sequences then continue above the restored ids.
 */
export const restoreRows = async (client: Queryable, file: string, key: Buffer): Promise<Record<string, number>> => {
    // Read it all once first: nothing is written from a file that fails the GCM check
    const { tables } = await readBackup(file, key);
    const restored: Record<string, number> = {};
    await client.query('BEGIN');
    try {
        for (const t of tables) {
            if (NOT_RESTORED.has(t.table) || !t.rows) continue;
            const existing = (await client.query(`SELECT count(*)::int AS n FROM public.${ident(t.table)}`)).rows[0]?.n;
            if (existing) throw new Error(`Table ${t.table} already has ${existing} rows: restore only into an empty database.`);
        }
        const columns = new Map<string, string>();
        await readBackup(file, key, async (table, rows) => {
            if (NOT_RESTORED.has(table.table)) return;
            let list = columns.get(table.table);
            if (!list) {
                list = sharedColumns(table, await tableColumns(client, table.table));
                columns.set(table.table, list);
            }
            const result = await client.query(
                `INSERT INTO public.${ident(table.table)} (${list})
                 SELECT ${list} FROM json_populate_recordset(NULL::public.${ident(table.table)}, $1::json)`,
                [`[${rows.join(',')}]`]
            ) as { rows: any[]; rowCount?: number | null };
            restored[table.table] = (restored[table.table] ?? 0) + (result.rowCount ?? 0);
        });
        const serials = (await client.query(
            `SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`
        )).rows;
        for (const s of serials) {
            await client.query(
                `SELECT setval(pg_get_serial_sequence($1, $2), m) FROM (SELECT max(${ident(s.column_name)}) AS m FROM public.${ident(s.table_name)}) x WHERE m IS NOT NULL`,
                [`public.${s.table_name}`, s.column_name]
            );
        }
        await client.query('COMMIT');
        return restored;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    }
};
