import { resolve } from 'path';
import { defineConfig } from 'vite';
import strip from '@rollup/plugin-strip';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@signalis/core',
      fileName: 'signalis-core',
    },
  },
  plugins: [
    strip({
      include: ['**/*.ts'],
      functions: ['assert'],
    }),
  ],
});
