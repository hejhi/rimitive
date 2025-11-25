import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
    alias: {
      // Provide a browser-safe version of ssr-context for client builds
      '@lattice/router/ssr-context': new URL(
        './src/ssr-context-browser.ts',
        import.meta.url
      ).pathname,
    },
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'src/client.ts',
      output: {
        entryFileNames: 'client.js',
        format: 'es',
      },
    },
  },
});
