import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.bench.{ts,tsx}'],
    benchmark: {
      // Include benchmark files
      include: ['src/**/*.bench.{ts,tsx}'],
    },
    // Pool options for benchmarks
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});