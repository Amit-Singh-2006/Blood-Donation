// Builds the website for Firebase Hosting and writes firebase.json.
//
//   node scripts/firebase-hosting.mjs https://<your API>.run.app
//   npx firebase-tools@15.32.1 deploy --only hosting --project <your project id>
//
// The API address goes into the build (VITE_API_BASE_URL) and into the
// Content-Security-Policy. Everything else copies vercel.json, so both hosts send
// the same security headers. VITE_CONTACT_EMAIL and VITE_GRIEVANCE_OFFICER_NAME
// are taken from the environment, if set.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERCEL_API = 'https://blood-donation-backend-sepia.vercel.app';

// Every path outside /assets/ (RE2 has no lookahead, so it is spelled out)
const NOT_ASSETS = '^/(?:[^a].*|a(?:[^s].*)?|as(?:[^s].*)?|ass(?:[^e].*)?|asse(?:[^t].*)?|asset(?:[^s].*)?|assets(?:[^/].*)?)?$';

/** firebase.json for this website, calling the API at `apiOrigin`. */
export const firebaseConfig = (vercel, apiOrigin) => {
  const security = vercel.headers.find((rule) => rule.source === '/(.*)').headers.map(({ key, value }) => ({
    key,
    value: key === 'Content-Security-Policy' ? value.replace(VERCEL_API, apiOrigin) : value,
  }));
  const csp = security.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
  if (!csp.includes(`connect-src 'self' ${apiOrigin} `)) throw new Error('The CSP in vercel.json no longer names the API in connect-src; update scripts/firebase-hosting.mjs.');
  return {
    hosting: {
      public: 'dist',
      ignore: ['firebase.json', '**/.*'],
      // Files that exist are served first; every other path is the app
      rewrites: [{ source: '**', destination: '/index.html' }],
      // Each path matches exactly one rule, which carries all its headers: Hosting
      // may apply only one matching rule (the emulator applies the first). Regex
      // rules, because the emulator ignores glob rules for headers.
      headers: [
        // Pages and other files: checked for a new version on every visit
        { regex: NOT_ASSETS, headers: [...security, { key: 'Cache-Control', value: 'no-cache' }] },
        // Built files carry a content hash in their names, so they never change
        { regex: '^/assets/', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
      ],
    },
  };
};

const main = async () => {
  let api;
  try { api = new URL(process.argv[2] ?? ''); } catch { /* reported below */ }
  if (!api || api.protocol !== 'https:' || api.pathname !== '/' || api.search) {
    console.error('Usage: node scripts/firebase-hosting.mjs https://<your API address>   (for example https://lifelink-api-123456789.asia-south1.run.app)');
    process.exit(1);
  }
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const config = firebaseConfig(vercel, api.origin);

  console.log(`Building the website for the API at ${api.origin} …`);
  process.env.VITE_API_BASE_URL = api.origin;
  const { build } = await import('vite');
  await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts') });

  fs.writeFileSync(path.join(ROOT, 'firebase.json'), JSON.stringify(config, null, 2) + '\n');
  console.log('\nWrote firebase.json. Now deploy it:\n  npx firebase-tools@15.32.1 deploy --only hosting --project <your project id>');
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
}
