/**
 * SSR Server
 *
 * Simple flow:
 * 1. Create router with initial path from request URL
 * 2. Create service with router's navigate/currentPath
 * 3. Render AppLayout to string
 * 4. Send HTML
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDOMServerAdapter } from '@lattice/islands/adapters/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '@lattice/islands/ssr-context';
import { renderToString } from '@lattice/islands/deps/renderToString';
import { createRouter } from '@lattice/router';

import { routes } from './routes.js';
import { createBaseService, type Service } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { tpl } from './tpl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

const clientBundlePath = isDev
  ? join(__dirname, '../dist/client/client.js')
  : join(__dirname, '../client/client.js');

/**
 * Create per-request service and router
 */
function createRequestService(pathname: string) {
  const adapter = createDOMServerAdapter();
  const baseSvc = createBaseService(adapter);

  // Create router with initial path from request
  const router = createRouter(
    { signal: baseSvc.signal, computed: baseSvc.computed },
    routes,
    { initialPath: pathname }
  );

  // Build full service with use helper
  const service: Service = {
    ...baseSvc,
    navigate: router.navigate,
    currentPath: router.currentPath,
    matches: router.matches,
    use: (component) => component(service),
  };

  return { service };
}

// Create HTTP server
const server = createServer((req, res) => {
  // Serve client bundle
  if (req.url === '/client.js') {
    if (existsSync(clientBundlePath)) {
      const bundle = readFileSync(clientBundlePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundle);
    } else {
      res.writeHead(404);
      res.end('Client bundle not found. Run: pnpm build:client');
    }
    return;
  }

  // Get pathname from request
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`
  );

  // Create per-request service
  const { service } = createRequestService(url.pathname);

  // Render the app
  const ctx = createSSRContext();
  const appSpec = AppLayout(service);
  const html = runWithSSRContext(ctx, () =>
    renderToString(appSpec().create(service))
  );
  const scripts = getIslandScripts(ctx);

  // Generate full HTML page
  const fullHtml = tpl(html, scripts);

  // Send response
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fullHtml);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/       - Home page`);
  console.log(`  http://localhost:${PORT}/about  - About page`);
  console.log(
    `  http://localhost:${PORT}/products - Products page (with island)`
  );
  console.log(`  http://localhost:${PORT}/products/1 - Product detail`);
  console.log('Press Ctrl+C to stop');
});
