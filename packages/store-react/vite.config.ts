import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.d.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'LatticeAdapterReact',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@lattice/core', '@lattice/runtime', 'react'],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
          '@lattice/runtime': 'LatticeRuntime',
          react: 'React',
        },
      },
    },
    sourcemap: true,
  },
});
