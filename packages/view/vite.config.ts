import { defineConfig } from 'vite';
import { resolve } from 'path';
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
  plugins: [terserMangleInternals()],
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
        el: resolve(__dirname, 'src/el.ts'),
        match: resolve(__dirname, 'src/match.ts'),
        portal: resolve(__dirname, 'src/portal.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        map: resolve(__dirname, 'src/map.ts'),
        'adapters/dom': resolve(__dirname, 'src/adapters/dom.ts'),
        'adapters/test': resolve(__dirname, 'src/adapters/test.ts'),
        'deps/scope': resolve(__dirname, 'src/deps/scope.ts'),
        'deps/processChildren': resolve(
          __dirname,
          'src/deps/processChildren.ts'
        ),
        'deps/addEventListener': resolve(
          __dirname,
          'src/deps/addEventListener.ts'
        ),
        'deps/mount': resolve(__dirname, 'src/deps/mount.ts'),
        'deps/use': resolve(__dirname, 'src/deps/use.ts'),
        'deps/node-deps': resolve(__dirname, 'src/deps/node-deps.ts'),
        'deps/fragment-boundaries': resolve(
          __dirname,
          'src/deps/fragment-boundaries.ts'
        ),
        adapter: resolve(__dirname, 'src/adapter.ts'),
        'devtools/index': resolve(__dirname, 'src/devtools/index.ts'),
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
