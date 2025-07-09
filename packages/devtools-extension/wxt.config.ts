import { defineConfig } from 'wxt';
import { resolve } from 'path';
import { watchWorkspace } from './vite-plugin-watch-workspace';

// See https://wxt.dev/api/config.html
export default defineConfig({
  alias: {
    '@lattice/core': resolve(__dirname, '../core/src/index.ts'),
    '@lattice/signals': resolve(__dirname, '../signals/src/index.ts'),
    '@lattice/devtools': resolve(__dirname, '../devtools/src/index.ts'),
  },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Lattice DevTools',
    description: 'Developer tools for debugging Lattice reactive applications',
    version: '0.0.1',
    permissions: ['storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['lattice-bridge.js'],
        matches: ['<all_urls>'],
      },
    ],
  },
  imports: {
    eslintrc: {
      enabled: 9, // Generate ESLint 9 compatible config
    },
  },
  vite: () => ({
    plugins: [watchWorkspace()],
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['@lattice/core', '@lattice/signals', '@lattice/devtools'],
    },
    server: {
      watch: {
        // Watch the source files of workspace dependencies
        ignored: ['!**/node_modules/@lattice/**'],
      },
      fs: {
        // Allow serving files from outside the project root
        allow: ['..'],
      },
    },
  }),
});
