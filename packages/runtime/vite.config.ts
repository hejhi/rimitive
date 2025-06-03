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
      name: 'LatticeRuntime',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['@lattice/core'],
      output: {
        preserveModules: false
      }
    },
    sourcemap: true,
    target: 'es2022' // Support for top-level await
  }
});