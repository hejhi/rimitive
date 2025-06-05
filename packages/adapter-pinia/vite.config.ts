import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022', // Support top-level await
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LatticeAdapterVue',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@lattice/core', '@lattice/runtime'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    includeSource: ['src/**/*.{js,ts}']
  }
});