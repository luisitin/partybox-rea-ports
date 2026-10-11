import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// One project: every test under packages/ and games/. 20 s per test like the main repo.
export default defineConfig({
  resolve: {
    alias: {
      '@partybox/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.{ts,tsx}', 'games/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20000,
    hookTimeout: 20000,
    environment: 'node',
    maxWorkers: 4,
  },
});
