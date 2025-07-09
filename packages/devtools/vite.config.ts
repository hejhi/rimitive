import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
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
      external: ['@lattice/signals', '@lattice/core'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
  },
});