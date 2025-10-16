import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  server: {
    port: 5174,
    open: true,
  },
  build: {
    target: 'esnext',
  },
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
