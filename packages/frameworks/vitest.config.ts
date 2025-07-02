import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    includeSource: ['./src/**/*.{js,ts,tsx}'],
    include: ['./src/**/*.{test,spec}.{js,ts,tsx}'],
  },
});
