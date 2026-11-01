#!/usr/bin/env node
/**
 * LifeLink on Antideploy (https://antideploy.com): the API (server/) runs as a
 * container that this script uploads, and the website is a static site that
 * Antideploy builds from GitHub on every push to main. See docs/antideploy.md.
 *
 *   node scripts/antideploy.mjs api [--force]   upload server/ and watch it go live
 *   node scripts/antideploy.mjs web             build the newest commit of main for the website
 *   node scripts/antideploy.mjs status [api|web] follow the latest deploy (a push starts the website's)
 *   node scripts/antideploy.mjs logs [api]      what the running API printed lately
 *
 * Only files git tracks are uploaded, so server/.env and everything else that
 * is gitignored never leaves this machine. The account token comes from
 * ~/.antideploy/config.json (or ANTIDEPLOY_TOKEN) and is never printed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://antideploy.com';
// Antideploy's own limits (GET https://antideploy.com/api/v1 → limits)
const LIMITS = { files: 4000, bytes: 29360128 };

// Each folder's .antideploy.json names its application
const TARGETS = {
    api: { dir: 'server' },
    web: { dir: '.' },
};

/** What the API's Dockerfile builds from: tests, other hosts' settings and any .env stay on this machine. */
const apiFile = (p) => !/^(test\/|vercel\.json$|\.gcloudignore$|\.antideploy\.json$|\.env)/.test(p);

const fail = (message) => { console.error(message); process.exit(1); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const token = () => {
    const fromEnv = (process.env.ANTIDEPLOY_TOKEN || process.env.ANTIDEPLOY_KEY || '').trim();
    if (fromEnv) return fromEnv;
    try {
        const saved = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.antideploy', 'config.json'), 'utf8')).token;
        if (saved) return saved;
    } catch { /* not connected yet */ }
    return fail('No Antideploy token. Connect this computer first: docs/antideploy.md, "Connecting".');
};

const call = async (method, url, { body, form } = {}) => {
    const headers = { authorization: `Bearer ${token()}` };
    let payload = form;
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(url.startsWith('http') ? url : BASE + url, { method, headers, body: payload });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
    return { status: res.status, data };
};

const why = (data) => [data.code ?? data.error, data.message ?? data.error_description ?? (data.code ? data.error : undefined)]
    .filter(Boolean).join(': ');

const appId = (target) => {
    const file = path.join(ROOT, TARGETS[target].dir, '.antideploy.json');
    try {
        const id = JSON.parse(fs.readFileSync(file, 'utf8')).applicationId;
        if (id) return id;
    } catch { /* missing */ }
    return fail(`${path.relative(ROOT, file) || '.antideploy.json'} is missing: see docs/antideploy.md.`);
};

/** The API's files to upload, relative to server/: tracked by git and needed by the build. */
export const apiFiles = () => {
    const cwd = path.join(ROOT, TARGETS.api.dir);
    return execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' })
        .split('\0')
        .filter((p) => p && apiFile(p) && fs.existsSync(path.join(cwd, p)));
};

const uploadApi = async (force) => {
    const id = appId('api');
    const cwd = path.join(ROOT, TARGETS.api.dir);
    const files = apiFiles();
    if (execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd, encoding: 'utf8' }).trim()) {
        console.log('Note: uncommitted changes in server/ are sent as they are now; files git does not track yet are not sent.');
    }
    const form = new FormData();
    let bytes = 0;
    for (const rel of files) {
        const content = fs.readFileSync(path.join(cwd, rel));
        bytes += content.length;
        form.append('files', new Blob([content]), rel);
        form.append('paths', rel);
    }
    if (files.length > LIMITS.files || bytes > LIMITS.bytes) fail(`Too big for Antideploy: ${files.length} files, ${bytes} bytes.`);
    if (force) form.append('force', 'true');

    const { status, data } = await call('POST', `/api/v1/deploy?applicationId=${id}`, { form });
    if (status === 200 && data.status === 'unchanged') return console.log('Nothing changed since the last upload, so nothing was built (add --force to build it again).');
    if (status !== 202) fail(`Antideploy refused the upload: ${status} ${why(data)}`);
    console.log(`Sent ${data.fileCount ?? files.length} files (${(bytes / 1024).toFixed(0)} KB)${data.account?.label ? ` to ${data.account.label}` : ''}; building…`);
    await watch(data.watch || `/api/v1/deployments/${data.taskId}`);
};

const redeployWeb = async () => {
    const { status, data } = await call('POST', '/api/v1/redeploy', { body: { applicationId: appId('web'), latest: true } });
    if (status === 200 && data.status === 'unchanged') return console.log('The newest commit of main is already live or on its way (node scripts/antideploy.mjs status web follows it).');
    if (status !== 202) fail(`Antideploy refused the build: ${status} ${why(data)}`);
    console.log(`Building commit ${String(data.commitSha ?? '').slice(0, 7) || '(newest)'} of main for the website…`);
    await watch(data.watch || `/api/v1/deployments/${data.taskId}`);
};

const printList = (title, items) => {
    if (!Array.isArray(items) || !items.length) return;
    console.log(title);
    for (const item of items) console.log(`  - ${typeof item === 'string' ? item : item.message ?? item.text ?? JSON.stringify(item)}`);
};

const tail = (text, lines = 40) => String(text ?? '').trimEnd().split('\n').slice(-lines).join('\n');

const watch = async (url) => {
    const started = Date.now();
    let last = '';
    for (;;) {
        const { status, data } = await call('GET', url);
        if (status !== 200) fail(`Could not read the deploy: ${status} ${why(data)}`);
        const running = Array.isArray(data.steps) ? data.steps.filter((s) => s.status === 'running').map((s) => s.name ?? s.step).join(', ') : '';
        const line = `${data.status}${running ? ` (${running})` : ''}`;
        if (line !== last) console.log(`  ${line}`);
        last = line;

        if (data.status === 'succeeded') {
            console.log(data.summary ?? `Live at ${data.url ?? data.deployment?.url ?? '(see the dashboard)'}`);
            printList('Warnings:', data.warnings);
            printList('Hazards:', data.hazards);
            let security = data.security;
            for (let i = 0; i < 6 && security?.status === 'scanning'; i++) {
                await sleep(5000);
                security = (await call('GET', url)).data.security;
            }
            if (security) {
                console.log(`Security check: ${security.message ?? security.status}`);
                for (const issue of security.issues ?? []) console.log(`  - [${issue.severity ?? 'issue'}] ${issue.title ?? issue.message}: ${issue.recommendation ?? ''}`);
            }
            return;
        }
        if (data.status === 'failed') {
            console.error(`Deploy failed${data.failedStep ? ` at ${data.failedStep}` : ''}: ${data.error ?? 'no reason given'}`);
            if (data.deployment?.buildLog) console.error(`--- end of the build log\n${tail(data.deployment.buildLog)}`);
            if (data.deployment?.runtimeLog) console.error(`--- what the app printed while starting\n${tail(data.deployment.runtimeLog)}`);
            process.exit(1);
        }
        if (Date.now() - started > 20 * 60_000) fail('Still not finished after 20 minutes: check the dashboard.');
        await sleep(5000);
    }
};

const latest = async (target) => {
    const { status, data } = await call('GET', `/api/v1/deployments?applicationId=${appId(target)}&limit=1`);
    if (status !== 200) fail(`Could not list deploys: ${status} ${why(data)}`);
    const newest = (data.deployments ?? data)[0];
    if (!newest) return console.log('No deploys yet.');
    console.log(`Latest deploy ${newest.id ?? newest.deploymentId}${newest.commit ? ` (commit ${String(newest.commit).slice(0, 7)})` : ''}:`);
    await watch(`/api/v1/deployments/${newest.id ?? newest.deploymentId}`);
};

const logs = async (target) => {
    const { status, data } = await call('GET', `/api/v1/logs?applicationId=${appId(target)}&limit=200`);
    if (status !== 200) fail(`Could not read the logs: ${status} ${why(data)}`);
    const lines = data.logs ?? data.lines ?? data.entries ?? [];
    for (const l of lines) console.log(typeof l === 'string' ? l : `${l.timestamp ?? l.at ?? l.time ?? ''} ${l.message ?? l.line ?? l.text ?? JSON.stringify(l)}`);
    if (!lines.length) console.log(data.message ?? 'No log lines yet.');
};

const main = async () => {
    const [command, ...rest] = process.argv.slice(2);
    const target = rest.find((a) => a === 'api' || a === 'web');
    if (command === 'api') return uploadApi(rest.includes('--force'));
    if (command === 'web') return redeployWeb();
    if (command === 'status') return latest(target ?? 'api');
    if (command === 'logs') return logs(target ?? 'api');
    fail('Usage: node scripts/antideploy.mjs api [--force] | web | status [api|web] | logs [api]');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
