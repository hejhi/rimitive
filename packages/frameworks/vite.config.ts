import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solidPlugin(),
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
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
