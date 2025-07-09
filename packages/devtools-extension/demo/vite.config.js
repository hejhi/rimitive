import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lattice/core': resolve(__dirname, '../../core/src/index.ts'),
      '@lattice/signals': resolve(__dirname, '../../signals/src/index.ts'),
      '@lattice/devtools': resolve(__dirname, '../../devtools/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});