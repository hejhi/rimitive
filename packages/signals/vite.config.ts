import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import * as esbuild from 'esbuild';
import type { Plugin } from 'vite';

const minifyBundle = (): Plugin => ({
  name: 'minify-bundle',
  async generateBundle(_, bundle) {
    for (const asset of Object.values(bundle)) {
      if (asset.type === 'chunk') {
        const result = await esbuild.transform(asset.code, {
          minify: true,
          target: 'es2022',
        });
        asset.code = result.code;
      }
    }
  },
});

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
    minifyBundle(),
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
        signal: resolve(__dirname, 'src/signal.ts'),
        computed: resolve(__dirname, 'src/computed.ts'),
        effect: resolve(__dirname, 'src/effect.ts'),
        batch: resolve(__dirname, 'src/batch.ts'),
        subscribe: resolve(__dirname, 'src/subscribe.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vitest', /^vitest/, 'node:test'],
      output: {
        entryFileNames: '[name].js',
      },
    },
    sourcemap: false,
    target: 'es2022',
    // Don't empty outDir in watch mode to prevent type resolution issues
    emptyOutDir: !process.argv.includes('--watch'),
  },
});