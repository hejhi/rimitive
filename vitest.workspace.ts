import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/adapter-pinia/vitest.config.ts',
  './packages/adapter-redux/vitest.config.ts',
  './packages/adapter-zustand/vitest.config.ts',
  './packages/benchmarks/vitest.config.ts',
  './packages/core/vitest.config.ts',
  './packages/examples/vitest.config.ts',
  './packages/runtime/vitest.config.ts',
  './packages/store-react/vitest.config.ts',
  './packages/store-vue/vitest.config.ts',
  './packages/test-utils/vitest.config.ts',
]);
