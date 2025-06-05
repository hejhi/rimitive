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
      name: 'LatticeAdapterZustand',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@lattice/core',
        '@lattice/runtime',
        'zustand',
        'zustand/vanilla',
        'zustand/react',
        'react',
      ],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
          '@lattice/runtime': 'LatticeRuntime',
          zustand: 'zustand',
          'zustand/vanilla': 'zustandVanilla',
          'zustand/react': 'zustandReact',
          react: 'React',
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
