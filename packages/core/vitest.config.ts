import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    includeSource: ['./src/**/*.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/adapters/contract.test.ts', // This is a test suite generator, not tests
    ],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
