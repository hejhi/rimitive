import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    includeSource: ['./src/**/*.{js,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@lattice/signals': path.resolve(__dirname, '../signals/src'),
      '@lattice/signals-store': path.resolve(__dirname, '../store/src'),
    },
  },
});
