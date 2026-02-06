import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'strip-css',
        resolveId(id) {
          if (id.endsWith('.css')) return '\0empty-css';
          return undefined;
        },
        load(id) {
          if (id === '\0empty-css') return '';
          return undefined;
        },
      },
    ],
  },
});
