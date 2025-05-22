import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/test-utils/index.ts'],
  format: ['esm'],
  dts: false, // Disabled - we're using tsc for declarations
  splitting: false,
  sourcemap: true,
  clean: false, // Don't clean, as we want to keep the declaration files
  treeshake: true,
  external: [],
});
