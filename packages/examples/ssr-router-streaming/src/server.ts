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
  createParse5Adapter,
  renderToStream,
  renderToData,
  createStreamWriter,
} from '@rimitive/ssr/server';
import type { RefSpec } from '@rimitive/view/types';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { getStyles } from './styles.js';
import { STREAM_KEY } from './config.js';

// Import data functions for API endpoints
import {
  getOverviewMetrics,
  getTopPages,
  getReferrers,
} from './data/api-metrics.js';
import { getSiteDetail, getSiteTraffic, getSites } from './data/api-sites.js';
import { getRecentEvents } from './data/api-events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

// Create stream writer - same key used on client in connectStream()
const stream = createStreamWriter(STREAM_KEY);

const clientDir = isDev
  ? join(__dirname, '../dist/client')
  : join(__dirname, '../client');
const clientBundlePath = join(clientDir, 'client.js');

// Create HTTP server
const server = createServer(async (req, res) => {
  // Serve client bundle and lazy-loaded chunks
  if (req.url === '/client.js' || req.url?.startsWith('/assets/')) {
    const filePath =
      req.url === '/client.js' ? clientBundlePath : join(clientDir, req.url);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Get pathname from request
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`
  );

  // API endpoints - serve real data with artificial delays
  if (url.pathname === '/api/overview') {
    const data = await getOverviewMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/api/top-pages') {
    const data = await getTopPages();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/api/referrers') {
    const data = await getReferrers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/api/sites') {
    const data = await getSites();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname.startsWith('/api/sites/')) {
    const siteId = url.pathname.split('/')[3];
    if (siteId && !url.pathname.includes('/traffic')) {
      const data = await getSiteDetail(siteId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
  }

  if (
    url.pathname.includes('/api/sites/') &&
    url.pathname.endsWith('/traffic')
  ) {
    const siteId = url.pathname.split('/')[3];
    if (siteId) {
      const data = await getSiteTraffic(siteId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
  }

  if (url.pathname === '/api/events') {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const data = await getRecentEvents(limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // /_data endpoint: prefetch data for client-side navigation
  if (url.pathname.startsWith('/_data/')) {
    const path = url.pathname.slice('/_data'.length) || '/';
    const { adapter: dataAdapter } = createParse5Adapter();
    const dataService = createService(dataAdapter, { initialPath: path });

    const data = await renderToData(AppLayout(dataService), {
      mount: (spec: RefSpec<unknown>) => spec.create(dataService),
      getData: () => dataService.loader.getData(),
    });

    console.log(
      `[data] Prefetch data for ${path}: ${Object.keys(data).join(', ')}`
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Create per-request service with streaming callback
  // onResolve writes data chunks to the streaming proxy
  const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
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
  <title>Analytics Dashboard — Rimitive SSR Streaming</title>
  <script>${stream.bootstrapCode()}</script>
  <style>${getStyles()}</style>
</head>
<body>`);

  // Write initial HTML (users see shell immediately)
  res.write(initialHtml);

  // Write client script - blocking to ensure hydration completes before chunks
  // Note: type="module" is required because Vite builds to ES module format
  res.write('<script type="module" src="/client.js"></script>');

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
  console.log('Analytics Dashboard — Streaming SSR');
  console.log('');
  console.log('Try these URLs:');
  console.log(
    `  http://localhost:${PORT}/           (overview — parallel streaming)`
  );
  console.log(
    `  http://localhost:${PORT}/sites/site-1  (site detail — nested streaming)`
  );
  console.log(
    `  http://localhost:${PORT}/feed        (event feed — streaming + interactivity)`
  );
});
