import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@signalis/react',
      fileName: 'signalis-react',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
  plugins: [],
});
