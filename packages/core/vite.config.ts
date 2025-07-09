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
        'src/adapters/contract.test.ts',
      ],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
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
    // Don't empty outDir in watch mode to prevent type resolution issues
    emptyOutDir: !process.argv.includes('--watch'),
  },
});
