import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.bench.{ts,tsx,svelte.ts}'],
    benchmark: {
      // Include benchmark files
      include: ['src/**/*.bench.{ts,tsx,svelte.ts}'],
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
  resolve: {
    // Enable browser conditions for Svelte 5 runes
    conditions: ['browser'],
  },
  esbuild: {
    jsx: 'automatic',
  },
});