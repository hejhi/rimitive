import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'signals/index': resolve(__dirname, 'src/signals/index.ts'),
        'rimitive/index': resolve(__dirname, 'src/rimitive/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        /^react-dom/,
        'scheduler',
        /^@rimitive\//,
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
