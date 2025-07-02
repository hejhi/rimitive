import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.d.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.ts'),
        vue: resolve(__dirname, 'src/vue.ts'),
        solid: resolve(__dirname, 'src/solid.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@lattice/core', 'react', 'vue', 'solid-js'],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js',
      },
    },
    sourcemap: true,
    target: 'es2022', // Support for top-level await
  },
});
