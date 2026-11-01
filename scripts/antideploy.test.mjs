import { describe, expect, it } from 'vitest';
import { filesFor } from './antideploy.mjs';

describe('what goes to Antideploy', () => {
    it('uploads what the API\'s Dockerfile builds from, and never a .env file, tests or other hosts\' settings', () => {
        const files = filesFor('api');
        for (const needed of ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'src/server.ts', 'src/app.ts']) {
            expect(files).toContain(needed);
        }
        expect(files.filter((f) => /(^|\/)\.env/.test(f) || f.startsWith('test/') || f === 'vercel.json' || f === '.gcloudignore')).toEqual([]);
    });

    it('uploads the website\'s source and nothing from the API, the Android app or the tests', () => {
        const files = filesFor('web');
        for (const needed of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vercel.json', 'src/App.tsx']) {
            expect(files).toContain(needed);
        }
        expect(files.filter((f) => !/^(src\/|index\.html$|package(-lock)?\.json$|vite\.config\.ts$|tsconfig\.json$|vercel\.json$)/.test(f))).toEqual([]);
        expect(files.filter((f) => /\.test\.tsx?$/.test(f) || /(^|\/)\.env/.test(f))).toEqual([]);
    });
});
