import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/adapter-store-react/vitest.config.ts',
  './packages/benchmarks/vitest.config.ts',
  './packages/core/vitest.config.ts',
  './packages/frameworks/vitest.config.ts',
]);
