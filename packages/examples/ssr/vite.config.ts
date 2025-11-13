import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/client.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
    },
  },
});
