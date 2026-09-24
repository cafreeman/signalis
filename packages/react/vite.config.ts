import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: '@signalis/react',
      fileName: 'signalis-react',
    },
    rollupOptions: {
      // `@signalis/core` MUST be external: the core reactivity graph lives in
      // module-level state, so bundling a second copy into this package would
      // create two independent reactive graphs (signals created via
      // `@signalis/core` would be invisible to `@signalis/react` and vice
      // versa)
      external: ['react', 'react-dom', '@signalis/core'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@signalis/core': 'SignalisCore',
        },
      },
    },
  },
  plugins: [],
});
