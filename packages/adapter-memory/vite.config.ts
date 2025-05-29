import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LatticeAdapterMemory',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@lattice/core'],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});
