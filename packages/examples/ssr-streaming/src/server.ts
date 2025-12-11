/**
 * SSR Streaming Server
 *
 * Demonstrates TRUE streaming SSR with Lattice:
 * 1. Send initial HTML immediately (with pending states for async boundaries)
 * 2. Stream BOTH data AND HTML chunks as each load() boundary resolves
 * 3. Client swaps in HTML immediately, then hydrates with correct data
 *
 * This is more efficient than renderToStringAsync for pages with slow data sources,
 * as users see the shell immediately and content appears progressively as data loads.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDOMServerAdapter,
  renderToStream,
  renderToString,
  defaultChunkFormatter,
  defaultHtmlChunkFormatter,
} from '@lattice/ssr/server';
import type { RefSpec } from '@lattice/view/types';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { getStyles } from './styles.js';

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

  // Create per-request service
  const adapter = createDOMServerAdapter();
  const service = createService(adapter, {
    initialPath: url.pathname,
  });

  // Render and get all pieces needed for streaming
  // onAsyncResolve streams BOTH data AND HTML as each boundary resolves
  const { headScript, initialHtml, clientScript, done, pendingCount } = renderToStream(
    AppLayout(service),
    {
      mount: (spec: RefSpec<unknown>) => spec.create(service),
      clientSrc: '/client.js',
      onAsyncResolve: (id, data, fragment) => {
        console.log(`[stream] Streaming chunk: ${id}`);
        // Stream data chunk (for hydration/signals)
        res.write(defaultChunkFormatter(id, data));
        // Stream HTML chunk (for immediate display)
        const html = renderToString(fragment);
        res.write(defaultHtmlChunkFormatter(id, html));
      },
    }
  );

  console.log(`[stream] Initial render complete, ${pendingCount} pending boundaries`);

  // Start response and write HTML document
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lattice SSR Streaming</title>
  ${headScript}
  <style>${getStyles()}</style>
</head>
<body>`);

  // Write initial HTML (users see shell immediately)
  res.write(initialHtml);

  // Write client script - blocking to ensure hydration completes before chunks
  res.write(clientScript);

  // Wait for all async boundaries to resolve
  // Chunks are streamed via onResolve as each boundary completes
  await done;

  console.log(`[stream] All boundaries resolved, closing response`);

  // Close the document
  res.write('</body></html>');
  res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Streaming SSR server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('This example demonstrates streaming SSR with HTML:');
  console.log('- Initial HTML is sent immediately with pending states');
  console.log('- Data AND HTML chunks stream as load() boundaries resolve');
  console.log('- Client swaps in HTML immediately for instant display');
  console.log('');
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/about`);
  console.log(`  http://localhost:${PORT}/products`);
  console.log(`  http://localhost:${PORT}/stats (async data - watch the streaming!)`);
});
