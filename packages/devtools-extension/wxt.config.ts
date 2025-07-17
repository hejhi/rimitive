import { defineConfig } from 'wxt';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchWorkspace } from './vite-plugin-watch-workspace';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  alias: {
    '@lattice/lattice': resolve(__dirname, '../lattice/src/index.ts'),
    '@lattice/signals': resolve(__dirname, '../signals/src/index.ts'),
    '@lattice/devtools': resolve(__dirname, '../devtools/src/index.ts'),
    '@/lib/utils': resolve(__dirname, 'src/lib/utils.ts'),
    '@/components': resolve(__dirname, 'src/components'),
    '@/hooks': resolve(__dirname, 'src/hooks'),
    '@': resolve(__dirname, 'src'),
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
        resources: [],
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
    resolve: {
      alias: {
        '@/lib/utils': resolve(__dirname, 'src/lib/utils.ts'),
        '@/components': resolve(__dirname, 'src/components'),
        '@/hooks': resolve(__dirname, 'src/hooks'),
        '@': resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['@lattice/lattice', '@lattice/signals', '@lattice/devtools'],
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
