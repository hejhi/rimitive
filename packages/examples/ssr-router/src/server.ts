/**
 * SSR Server (Basic Sync)
 *
 * Simple flow:
 * 1. Create service with initial path from request URL
 * 2. Render AppLayout to string using renderToString
 * 3. Send HTML
 *
 * This is the simplest SSR setup - no async data loading.
 * For async data, see ssr-router-async example.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createParse5Adapter, renderToString } from '@rimitive/ssr/server';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { tpl } from './tpl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

const clientBundlePath = isDev
  ? join(__dirname, '../dist/client/client.js')
  : join(__dirname, '../client/client.js');

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

  // Create per-request service with initial path
  const { adapter, serialize } = createParse5Adapter();
  const service = createService(adapter, { initialPath: url.pathname });

  // Create and render the app
  const root = AppLayout(service).create(service);
  const html = renderToString(root, serialize);

  // Send response
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(tpl(html, ''));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('This example demonstrates basic sync SSR with renderToString.');
  console.log('All content is static - no async data loading.');
  console.log('For async data loading, see the ssr-router-async example.');
  console.log('');
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/services`);
  console.log(`  http://localhost:${PORT}/services/consulting`);
  console.log(`  http://localhost:${PORT}/about`);
  console.log(`  http://localhost:${PORT}/contact`);
});
