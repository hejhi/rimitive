import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.d.ts',
        'src/**/test-*.ts',
        'src/**/*-tests.ts',
      ],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        testing: resolve(__dirname, 'src/testing.ts'),
        base: resolve(__dirname, 'src/base.ts'),
        runtime: resolve(__dirname, 'src/runtime.ts'),
        core: resolve(__dirname, 'src/core.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vitest', /^vitest/, 'node:test'],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js',
        manualChunks: undefined,
      },
    },
    sourcemap: true,
    target: 'es2022', // Support for top-level await
  },
});
