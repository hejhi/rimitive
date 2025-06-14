import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  publicDir: 'dist',
  server: {
    port: 8080,
    open: '/dashboard.html'
  },
  build: {
    outDir: 'dist-dashboard'
  }
});