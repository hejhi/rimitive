import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.d.ts']
    })
  ],
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
