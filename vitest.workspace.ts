import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/benchmarks/vitest.config.ts',
  './packages/lattice/vitest.config.ts',
  './packages/signals/vitest.config.ts',
]);
