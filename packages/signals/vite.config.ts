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
        index: resolve(__dirname, 'src/index.ts'),
        extend: resolve(__dirname, 'src/extend.ts'),
        signal: resolve(__dirname, 'src/signal.ts'),
        computed: resolve(__dirname, 'src/computed.ts'),
        effect: resolve(__dirname, 'src/effect.ts'),
        batch: resolve(__dirname, 'src/batch.ts'),
        subscribe: resolve(__dirname, 'src/subscribe.ts'),
        untrack: resolve(__dirname, 'src/untrack.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        'devtools/signal': resolve(__dirname, 'src/devtools/signal.ts'),
        'devtools/computed': resolve(__dirname, 'src/devtools/computed.ts'),
        'devtools/effect': resolve(__dirname, 'src/devtools/effect.ts'),
        'devtools/batch': resolve(__dirname, 'src/devtools/batch.ts'),
        'devtools/subscribe': resolve(__dirname, 'src/devtools/subscribe.ts'),
        'deps/scheduler': resolve(__dirname, 'src/deps/scheduler.ts'),
        'deps/graph-edges': resolve(__dirname, 'src/deps/graph-edges.ts'),
        'deps/graph-traversal': resolve(
          __dirname,
          'src/deps/graph-traversal.ts'
        ),
        'deps/pull-propagator': resolve(
          __dirname,
          'src/deps/pull-propagator.ts'
        ),
        'presets/core': resolve(__dirname, 'src/presets/core.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vitest', /^vitest/, 'node:test', '@lattice/lattice'],
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
