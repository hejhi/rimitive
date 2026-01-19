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
  },
  resolve: {
    // Prefer Node conditions for benchmarking
    conditions: ['node'],
  },
  esbuild: {
    jsx: 'automatic',
  },
});
