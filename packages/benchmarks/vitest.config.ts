import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    // Use Node for microbench timing and memory stability
    environment: 'node',
    include: ['src/**/*.bench.{ts,tsx}'],
    benchmark: {
      // Include benchmark files
      include: ['src/**/*.bench.{ts,tsx}'],
      // Enhanced reporting for performance analysis with memory tracking
      reporters: ['verbose'],
    },
    // Pool options for benchmarks - use separate processes for memory isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        // Use a single fork so shared setup in beforeAll is visible
        // across benches in the same file (prevents NaN comparisons).
        singleFork: true,
      },
    },
  },
  resolve: {
    // Prefer Node conditions for benchmarking
    conditions: ['node'],
  },
  esbuild: {
    jsx: 'automatic',
  },
});
