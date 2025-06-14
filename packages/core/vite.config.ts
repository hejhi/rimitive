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
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        testing: resolve(__dirname, 'src/testing.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['vitest'],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js'
      }
    },
    sourcemap: true,
    target: 'es2022' // Support for top-level await
  }
});