import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5175,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'esnext',
  },
});
