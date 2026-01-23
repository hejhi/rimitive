/**
 * SSR Streaming Server
 *
 * Demonstrates streaming SSR with Rimitive:
 * 1. Send initial HTML immediately (with pending states for async boundaries)
 * 2. Stream data chunks as each load() boundary resolves
 * 3. Client receives data and updates UI reactively via signals
 *
 * This is more efficient than renderToStringAsync for pages with slow data sources,
 * as users see the shell immediately and content appears progressively as data loads.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createLinkedomAdapter,
  renderToStream,
  createStreamWriter,
} from '@rimitive/ssr/server';
import type { RefSpec } from '@rimitive/view/types';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { getStyles } from './styles.js';
import { STREAM_KEY } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

// Create stream writer - same key used on client in connectStream()
const stream = createStreamWriter(STREAM_KEY);

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

  // Create per-request service with streaming callback
  // onResolve writes data chunks to the streaming proxy
  const { adapter, serialize, insertFragmentMarkers } =
    createLinkedomAdapter();
  const service = createService(adapter, {
    initialPath: url.pathname,
    onResolve: (id, data) => {
      console.log(`[stream] Streaming chunk: ${id}`);
      res.write(`<script>${stream.chunkCode(id, data)}</script>`);
    },
  });

  // Render and get all pieces needed for streaming
  const { initialHtml, done, pendingCount } = renderToStream(
    AppLayout(service),
    {
      mount: (spec: RefSpec<unknown>) => spec.create(service),
      serialize,
      insertFragmentMarkers,
    }
  );

  console.log(
    `[stream] Initial render complete, ${pendingCount} pending boundaries`
  );

  // Start response and write HTML document
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rimitive SSR Streaming</title>
  <script>${stream.bootstrapCode()}</script>
  <style>${getStyles()}</style>
</head>
<body>`);

  // Write initial HTML (users see shell immediately)
  res.write(initialHtml);

  // Write client script - blocking to ensure hydration completes before chunks
  res.write('<script src="/client.js"></script>');

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
  console.log('This example demonstrates streaming SSR:');
  console.log('- Initial HTML is sent immediately with pending states');
  console.log('- Data chunks stream as load() boundaries resolve');
  console.log('- Client updates reactively via signals (no DOM manipulation)');
  console.log('');
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/about`);
  console.log(`  http://localhost:${PORT}/products`);
  console.log(
    `  http://localhost:${PORT}/stats (async data - watch the streaming!)`
  );
});
