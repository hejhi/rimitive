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
        el: resolve(__dirname, 'src/el.ts'),
        map: resolve(__dirname, 'src/map.ts'),
        match: resolve(__dirname, 'src/match.ts'),
        context: resolve(__dirname, 'src/context.ts'),
        types: resolve(__dirname, 'src/types.ts'),
        renderer: resolve(__dirname, 'src/renderer.ts'),
        on: resolve(__dirname, 'src/on.ts'),
        'browser-renderer': resolve(__dirname, 'src/browser-renderer.ts'),
        'renderers/dom': resolve(__dirname, 'src/renderers/dom.ts'),
        'helpers/scope': resolve(__dirname, 'src/helpers/scope.ts'),
        'helpers/processChildren': resolve(
          __dirname,
          'src/helpers/processChildren.ts'
        ),
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
