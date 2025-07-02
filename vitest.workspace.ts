import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/benchmarks/vitest.config.ts',
  './packages/core/vitest.config.ts',
  './packages/frameworks/vitest.config.ts',
]);
