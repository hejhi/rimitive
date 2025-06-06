import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.bench.{ts,tsx}'],
    benchmark: {
      // Include benchmark files
      include: ['src/**/*.bench.{ts,tsx}'],
      // Output JSON results when specified via CLI
      // outputJson: 'bench-results.json', // Can be overridden via CLI
      // reporters: ['default', 'json'], // Available reporters
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