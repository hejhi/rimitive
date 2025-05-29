import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  "./packages/adapter-zustand/vitest.config.ts",
  "./packages/adapter-memory/vitest.config.ts",
  "./packages/test-utils/vitest.config.ts",
  "./packages/core/vitest.config.ts"
])
