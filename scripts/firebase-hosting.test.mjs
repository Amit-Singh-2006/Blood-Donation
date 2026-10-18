import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { firebaseConfig } from './firebase-hosting.mjs';

const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const API = 'https://lifelink-api-123456789.asia-south1.run.app';

describe('Firebase Hosting config', () => {
  const config = firebaseConfig(vercel, API);
  const rulesFor = (p) => config.hosting.headers.filter((rule) => new RegExp(rule.regex).test(p));
  const headersFor = (p) => Object.fromEntries(rulesFor(p).flatMap((rule) => rule.headers).map((h) => [h.key, h.value]));

  it('gives every path exactly one header rule, so it cannot matter which rule Hosting prefers', () => {
    for (const p of ['/', '/donor', '/donor/settings', '/certificate/LC-4K7Q-M2XZ', '/about', '/assets', '/assetsx', '/as', '/favicon.ico', '/index.html', '/assets/index-CyZX7-26.js', '/assets/sub/a.css']) {
      expect(rulesFor(p), p).toHaveLength(1);
    }
  });

  it('sends the same security headers as vercel.json on every page', () => {
    for (const p of ['/', '/donor/settings', '/index.html', '/assets']) {
      for (const { key, value } of vercel.headers[0].headers) {
        if (key !== 'Content-Security-Policy') expect(headersFor(p)[key], `${p} ${key}`).toBe(value);
      }
    }
  });

  it('lets the page call the new API, and only that API', () => {
    const csp = headersFor('/')['Content-Security-Policy'];
    expect(csp).toContain(`connect-src 'self' ${API} https://api.github.com`);
    expect(csp).not.toContain('vercel.app');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('serves the app for every path and caches only the hashed build files', () => {
    expect(config.hosting.public).toBe('dist');
    expect(config.hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }]);
    expect(headersFor('/')['Cache-Control']).toBe('no-cache');
    expect(headersFor('/donor/settings')['Cache-Control']).toBe('no-cache');
    expect(headersFor('/assets/index-CyZX7-26.js')).toEqual({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  });
});
