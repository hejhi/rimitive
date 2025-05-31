import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.ts'),
      },
      name: 'LatticeAdapterZustand',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@lattice/core', 'zustand', 'zustand/vanilla', 'zustand/react', 'react'],
      output: {
        globals: {
          '@lattice/core': 'LatticeCore',
          'zustand': 'zustand',
          'zustand/vanilla': 'zustandVanilla',
          'zustand/react': 'zustandReact',
          'react': 'React',
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
