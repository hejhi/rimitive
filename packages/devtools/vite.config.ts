import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      pathsToAliases: false,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LatticeDevTools',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@lattice/signals', '@lattice/lattice'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    // Don't empty outDir in watch mode to prevent type resolution issues
    emptyOutDir: !process.argv.includes('--watch'),
  },
});
