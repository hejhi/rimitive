import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'jsdom',
    includeSource: ['./src/**/*.{js,ts}'],
    include: ['./src/**/*.{test,spec}.{js,ts,svelte.ts}'],
  },
});
