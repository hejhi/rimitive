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
      ],
    }),
  ],
  esbuild: {
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'type-guards': resolve(__dirname, 'src/type-guards.ts'),
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
    sourcemap: false,
    target: 'es2022',
    // Don't empty outDir in watch mode to prevent type resolution issues
    emptyOutDir: !process.argv.includes('--watch'),
  },
});