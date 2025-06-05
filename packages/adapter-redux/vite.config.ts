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
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'LatticeAdapterRedux',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@lattice/core',
        '@lattice/runtime',
        '@reduxjs/toolkit',
        'redux',
        'react',
        'react-redux',
      ],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
          '@lattice/runtime': 'LatticeRuntime',
          '@reduxjs/toolkit': 'RTK',
          redux: 'Redux',
          react: 'React',
          'react-redux': 'ReactRedux',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});
