import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.d.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        vanilla: resolve(__dirname, 'src/vanilla.ts'),
        react: resolve(__dirname, 'src/react.ts'),
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'LatticeStore',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
  },
});
