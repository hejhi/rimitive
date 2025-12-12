import { defineConfig } from 'wxt';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchWorkspace } from './vite-plugin-watch-workspace';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  alias: {
    '@rimitive/signals-store': resolve(
      __dirname,
      '../signals-store/src/index.ts'
    ),
    '@rimitive/signals/extend': resolve(__dirname, '../signals/src/extend.ts'),
    '@rimitive/signals': resolve(__dirname, '../signals/src/index.ts'),
    '@rimitive/core': resolve(__dirname, '../core/src/index.ts'),
    '@/lib/utils': resolve(__dirname, 'src/lib/utils.ts'),
    '@/components': resolve(__dirname, 'src/components'),
    '@/hooks': resolve(__dirname, 'src/hooks'),
    '@': resolve(__dirname, 'src'),
  },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Rimitive DevTools',
    description: 'Developer tools for debugging Rimitive reactive applications',
    version: '0.0.1',
    permissions: ['storage', 'scripting', 'webNavigation'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['devtools-api.js'],
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
        '@rimitive/signals/extend': resolve(
          __dirname,
          '../signals/src/extend.ts'
        ),
        '@rimitive/signals': resolve(__dirname, '../signals/src/index.ts'),
        '@rimitive/core': resolve(__dirname, '../core/src/index.ts'),
        '@/lib/utils': resolve(__dirname, 'src/lib/utils.ts'),
        '@/components': resolve(__dirname, 'src/components'),
        '@/hooks': resolve(__dirname, 'src/hooks'),
        '@': resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: [
        '@rimitive/signals-store',
        '@rimitive/signals',
        '@rimitive/core',
      ],
    },
    server: {
      watch: {
        // Watch the source files of workspace dependencies
        ignored: ['!**/node_modules/@rimitive/**'],
      },
      fs: {
        // Allow serving files from outside the project root
        allow: ['..'],
      },
    },
  }),
});
