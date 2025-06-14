import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/test-utils/**'],
    },
  },
  resolve: {
    alias: {
      '@lattice/core': resolve(__dirname, '../core/src'),
    },
  },
});
