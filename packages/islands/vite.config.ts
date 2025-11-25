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
        types: resolve(__dirname, 'src/types.ts'),
        'ssr-context': resolve(__dirname, 'src/ssr-context.ts'),
        'ssr-context.browser': resolve(__dirname, 'src/ssr-context.browser.ts'),
        island: resolve(__dirname, 'src/island.ts'),
        'island.browser': resolve(__dirname, 'src/island.browser.ts'),
        'hydration-api': resolve(__dirname, 'src/hydration-api.ts'),
        'hydrators/dom': resolve(__dirname, 'src/hydrators/dom.ts'),
        'helpers/renderToString': resolve(
          __dirname,
          'src/helpers/renderToString.ts'
        ),
        'renderers/dom-server': resolve(
          __dirname,
          'src/renderers/dom-server.ts'
        ),
        'renderers/dom-hydration': resolve(
          __dirname,
          'src/renderers/dom-hydration.ts'
        ),
        'renderers/islands': resolve(__dirname, 'src/renderers/islands.ts'),
        'presets/island-ssr': resolve(__dirname, 'src/presets/island-ssr.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vitest',
        /^vitest/,
        'node:test',
        'node:async_hooks',
        '@lattice/lattice',
        '@lattice/signals',
        '@lattice/view',
        /^@lattice\/view\//,
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
