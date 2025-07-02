import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
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
        singleFork: false, // Allow multiple forks for better memory isolation
      },
    },
    // Enable memory tracking in Node.js
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    // Enable browser conditions for Svelte 5 runes
    conditions: ['browser'],
  },
  esbuild: {
    jsx: 'automatic',
  },
});
