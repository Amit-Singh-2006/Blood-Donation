import { describe, expect, it } from 'vitest';
import { apiFiles } from './antideploy.mjs';

describe('what goes to Antideploy', () => {
    it('uploads what the API\'s Dockerfile builds from, and never a .env file, tests or other hosts\' settings', () => {
        const files = apiFiles();
        for (const needed of ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'src/server.ts', 'src/app.ts']) {
            expect(files).toContain(needed);
        }
        expect(files.filter((f) => /(^|\/)\.env/.test(f) || f.startsWith('test/') || f === 'vercel.json' || f === '.gcloudignore')).toEqual([]);
    });
});
