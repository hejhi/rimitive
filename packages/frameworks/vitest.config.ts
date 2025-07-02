import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    includeSource: ['./src/**/*.{js,ts,tsx}'],
    include: ['./src/**/*.{test,spec}.{js,ts,tsx}'],
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      'solid-js': 'solid-js/dist/solid.js',
      'solid-js/web': 'solid-js/web/dist/web.js',
      'solid-js/store': 'solid-js/store/dist/store.js',
    },
  },
});
