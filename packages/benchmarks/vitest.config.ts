import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.bench.ts'],
    benchmark: {
      // Include benchmark files
      include: ['src/**/*.bench.ts'],
    },
    // Pool options for benchmarks
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});