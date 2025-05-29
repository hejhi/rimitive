import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    includeSource: ['src/**/*.ts'],
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});