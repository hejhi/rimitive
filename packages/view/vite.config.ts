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
        'src/**/*.example.ts',
      ],
      rollupTypes: false,
      staticImport: true,
    }),
  ],
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  build: {
    lib: {
      entry: {
        el: resolve(__dirname, 'src/el.ts'),
        elMap: resolve(__dirname, 'src/elMap.ts'),
        context: resolve(__dirname, 'src/context.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        'helpers/scope': resolve(__dirname, 'src/helpers/scope.ts'),
        'helpers/reconcile': resolve(__dirname, 'src/helpers/reconcile.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vitest',
        /^vitest/,
        'node:test',
        '@lattice/lattice',
        '@lattice/signals',
        /^@lattice\/signals\//,
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
    sourcemap: false,
    target: 'es2022',
    emptyOutDir: !process.argv.includes('--watch'),
  },
});
