import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Website tests: npm test. jsdom stands in for the browser.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    restoreMocks: true,
    unstubGlobals: true,
    // Node 25's own localStorage would hide jsdom's
    execArgv: ['--no-experimental-webstorage'],
  },
});
