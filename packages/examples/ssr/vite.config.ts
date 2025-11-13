import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
