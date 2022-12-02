import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@reactiv/react',
      fileName: 'reactiv-react',
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@reactiv/core'],
    },
  },
  plugins: [],
});
