import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts', 'src/**/*.svelte.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.d.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'LatticeAdapterSvelte',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@lattice/core', '@lattice/runtime', 'svelte', 'svelte/store'],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
          '@lattice/runtime': 'LatticeRuntime',
          svelte: 'Svelte',
          'svelte/store': 'SvelteStore',
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
    target: 'esnext',
  },
});
