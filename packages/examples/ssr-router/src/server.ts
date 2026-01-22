/**
 * SSR Server
 *
 * Simple flow:
 * 1. Create service with initial path from request URL
 * 2. Render AppLayout to string (awaiting async boundaries from load())
 * 3. Serialize loader data to a script tag for client hydration
 * 4. Send HTML
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDOMServerAdapter,
  renderToStringAsync,
  safeJsonStringify,
} from '@rimitive/ssr/server';
import type { RefSpec } from '@rimitive/view/types';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { tpl } from './tpl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

const clientBundlePath = isDev
  ? join(__dirname, '../dist/client/client.js')
  : join(__dirname, '../client/client.js');

// Create HTTP server
const server = createServer(async (req, res) => {
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

  // Create per-request service with initial path
  const { adapter, serialize, insertFragmentMarkers } =
    createDOMServerAdapter();
  const service = createService(adapter, { initialPath: url.pathname });

  // Create the app RefSpec
  const appSpec = AppLayout(service);

  // Render the app to string, awaiting any async boundaries (load())
  const html = await renderToStringAsync(appSpec, {
    svc: service,
    mount: (spec: RefSpec<unknown>) => spec.create(service),
    serialize,
    insertFragmentMarkers,
  });

  // Get collected loader data for hydration
  const loaderData = service.loader.getData();

  // Create hydration script with loader data (using safeJsonStringify to prevent XSS)
  const hydrationScript =
    Object.keys(loaderData).length > 0
      ? `<script>window.__RIMITIVE_DATA__=${safeJsonStringify(loaderData)}</script>`
      : '';

  // Send response
  res.writeHead(200, { 'Content-Type': 'text/html' });

  // Generate and send HTML with loader data
  res.end(tpl(html, hydrationScript));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/about`);
  console.log(`  http://localhost:${PORT}/products`);
  console.log(`  http://localhost:${PORT}/products/1`);
  console.log(
    `  http://localhost:${PORT}/stats (async data loading with load())`
  );
});
