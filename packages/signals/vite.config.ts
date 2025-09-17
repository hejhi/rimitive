import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import type { Plugin } from 'vite';
import { minify } from 'terser';

// Minify + mangle internal properties (those starting with `_`) with a shared nameCache
// Ensures consistent mangling across all emitted chunks in this build.
const terserMangleInternals = (): Plugin => {
  const nameCache: Record<string, unknown> = {};
  return {
    name: 'terser-mangle-internals',
    async generateBundle(_, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'chunk') continue;
        const result = await minify(asset.code, {
          module: true,
          toplevel: true,
          compress: true,
          mangle: {
            toplevel: true,
            properties: {
              regex: /^_/,
              // Keep quoted properties as-is for safety
              keep_quoted: true,
            },
          },
          format: {
            comments: false,
          },
          nameCache,
        });
        if (result.code) asset.code = result.code;
      }
    },
  };
};

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
      // Don't use rollupTypes with subdirectory entries - it doesn't work well
      rollupTypes: false,
      staticImport: true,
    }),
    terserMangleInternals(),
  ],
  esbuild: {
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  build: {
    lib: {
      entry: {
        api: resolve(__dirname, 'src/api.ts'),
        signal: resolve(__dirname, 'src/signal.ts'),
        computed: resolve(__dirname, 'src/computed.ts'),
        effect: resolve(__dirname, 'src/effect.ts'),
        batch: resolve(__dirname, 'src/batch.ts'),
        subscribe: resolve(__dirname, 'src/subscribe.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        context: resolve(__dirname, 'src/context.ts'),
        constants: resolve(__dirname, 'src/constants.ts'),
        'helpers/scheduler': resolve(__dirname, 'src/helpers/scheduler.ts'),
        'helpers/graph-edges': resolve(__dirname, 'src/helpers/graph-edges.ts'),
        'helpers/pull-propagator': resolve(__dirname, 'src/helpers/pull-propagator.ts'),
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
