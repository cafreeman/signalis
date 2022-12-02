import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
