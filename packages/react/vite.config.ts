import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.test.d.ts',
        'src/**/test-*.ts',
        'src/test-setup.ts',
      ],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'signals/index': resolve(__dirname, 'src/signals/index.ts'),
        'lattice/index': resolve(__dirname, 'src/lattice/index.ts'),
        'testing/index': resolve(__dirname, 'src/testing/index.tsx'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@lattice/signals',
        '@lattice/signals-store',
        '@testing-library/react',
        'vitest',
        /^vitest/,
        'node:test',
      ],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js',
        manualChunks: undefined,
      },
    },
    sourcemap: true,
    target: 'es2022',
    emptyOutDir: !process.argv.includes('--watch'),
  },
});
