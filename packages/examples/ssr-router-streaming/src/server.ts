/**
 * SSR Streaming Server
 *
 * Demonstrates streaming SSR with Rimitive using the server abstraction layer:
 * - createStaticHandler: serves client bundles and lazy-loaded chunks
 * - createDataPrefetchHandler: serves pre-rendered data for client-side navigation
 * - createStreamingServer: progressive SSR with immediate shell + streamed data
 */
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createParse5Adapter,
  createStreamingServer,
  createStaticHandler,
  createDataPrefetchHandler,
} from '@rimitive/ssr/server';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { getStyles } from './styles.js';
import { STREAM_KEY } from './config.js';
import { apiRoutes } from './api-routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');
const clientDir = isDev
  ? join(__dirname, '../dist/client')
  : join(__dirname, '../client');

// Static asset handler
const serveStatic = createStaticHandler({
  clientDir,
  urlPatterns: ['/client.js', '/assets/'],
});

// Data prefetch handler for client-side navigation
const handlePrefetch = createDataPrefetchHandler({
  createService: (path) => {
    const { adapter } = createParse5Adapter();
    return createService(adapter, { initialPath: path });
  },
  createApp: (service) => AppLayout(service),
  mount: (service) => (spec) => spec.create(service),
  getData: (service) => service.loader.getData(),
});

// Streaming SSR handler
const handleStreaming = createStreamingServer({
  shell: {
    title: 'Analytics Dashboard — Rimitive SSR Streaming',
    streamKey: STREAM_KEY,
    styles: getStyles(),
    rootId: false,
  },
  clientSrc: '/client.js',
  createService: ({ pathname, onResolve }) => {
    const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
    const service = createService(adapter, { initialPath: pathname, onResolve });
    return { service, serialize, insertFragmentMarkers };
  },
  createApp: (service) => AppLayout(service),
  mount: (service) => (spec) => spec.create(service),
});

// Create HTTP server
const server = createServer(async (req, res) => {
  if (serveStatic(req, res)) return;
  if (await apiRoutes(req, res)) return;
  if (await handlePrefetch(req, res)) return;
  await handleStreaming(req, res);
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
