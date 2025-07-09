import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lattice/signals': resolve('../../packages/signals/src/index.ts'),
      '@lattice/core': resolve('../../packages/core/src/index.ts'),
      '@lattice/devtools': resolve('../../packages/devtools/src/index.ts'),
    },
  },
});