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
              regex: /^_[^_]/,
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
        'index.browser': resolve(__dirname, 'src/index.browser.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        'server/index': resolve(__dirname, 'src/server/index.ts'),
        'client/index': resolve(__dirname, 'src/client/index.ts'),
        'ssr-context': resolve(__dirname, 'src/ssr-context.ts'),
        'ssr-context.browser': resolve(__dirname, 'src/ssr-context.browser.ts'),
        island: resolve(__dirname, 'src/island.ts'),
        'island.browser': resolve(__dirname, 'src/island.browser.ts'),
        'hydration-svc': resolve(__dirname, 'src/hydration-svc.ts'),
        'hydrators/dom': resolve(__dirname, 'src/hydrators/dom.ts'),
        'deps/renderToString': resolve(__dirname, 'src/deps/renderToString.ts'),
        'adapters/dom-server': resolve(__dirname, 'src/adapters/dom-server.ts'),
        'adapters/dom-hydration': resolve(
          __dirname,
          'src/adapters/dom-hydration.ts'
        ),
        'adapters/islands': resolve(__dirname, 'src/adapters/islands.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vitest',
        /^vitest/,
        'node:test',
        'node:http',
        'node:async_hooks',
        '@lattice/lattice',
        '@lattice/view',
        /^@lattice\/view\//,
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
