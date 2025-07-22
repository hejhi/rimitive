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
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'extensions/signal': resolve(__dirname, 'src/extensions/signal.ts'),
        'extensions/computed': resolve(__dirname, 'src/extensions/computed.ts'),
        'extensions/effect': resolve(__dirname, 'src/extensions/effect.ts'),
        'extensions/batch': resolve(__dirname, 'src/extensions/batch.ts'),
        'extensions/select': resolve(__dirname, 'src/extensions/select.ts'),
        'extensions/subscribe': resolve(__dirname, 'src/extensions/subscribe.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vitest', /^vitest/, 'node:test', '@lattice/signals', /^@lattice\/signals\//],
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
