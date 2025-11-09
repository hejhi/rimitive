import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    includeSource: ['./src/**/*.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
    // Prefer threads to avoid child-process kill in constrained sandbox
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    reporters: ['default']
  },
});
