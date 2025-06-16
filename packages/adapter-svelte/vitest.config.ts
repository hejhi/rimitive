import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'happy-dom',
    includeSource: ['src/**/*.{js,ts,svelte.ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts,svelte.ts}'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/test-utils/**'],
    },
  },
  resolve: {
    alias: {
      '@lattice/core': resolve(__dirname, '../core/src'),
    },
    // Enable browser conditions for Svelte 5 runes
    conditions: process.env.VITEST ? ['browser'] : undefined,
  },
});
