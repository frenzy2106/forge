import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Vitest config for Forge.
// - The `@/` alias mirrors tsconfig.json paths so test files can import like
//   src code does (e.g., `import { db } from '@/db/client'`).
// - `pool: 'forks'` keeps libSQL `:memory:` clients fully isolated per worker
//   so cascade/restrict tests across files don't bleed schema state.
// - We do NOT enable globals; tests import { describe, it, expect } explicitly.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    pool: 'forks',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
