import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'src/client.ts',
      output: {
        entryFileNames: 'client.js',
        format: 'es',
      },
    },
  },
});
