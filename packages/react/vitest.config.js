import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    // Core dist is ignored and may be stale while developing. Tests must
    // execute the workspace source so they validate the code under review.
    alias: {
      '@signalis/core': resolve(import.meta.dirname, '../core/src/index.ts'),
    },
  },
  plugins: [
    react({
      include: 'tests/**/*.tsx',
    }),
  ],
  test: {
    environment: 'jsdom',
    typecheck: './tsconfig.test.json',
  },
});
