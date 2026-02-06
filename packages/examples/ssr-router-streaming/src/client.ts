/**
 * Client-side Hydration with Streaming Support
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * For streaming SSR:
 * - Server creates a stream receiver via stream.bootstrap()
 * - connectStream() connects the loader to that receiver
 * - Data flows through signals, updating the UI reactively
 */
import { createClientAdapter, connectStream } from '@rimitive/ssr/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { STREAM_KEY, APP_ROOT } from './config.js';
import { createPrefetch } from './ssr/prefetch.js';

// Create hydration adapter
const adapter = createClientAdapter(document.querySelector(APP_ROOT)!);

// Create service with hydrating adapter
// Pass initialPath explicitly to ensure router matches server state during hydration
// onNavigate fires a data prefetch in parallel with lazy chunk loading
const ref: { prefetch: (path: string) => void } = {
  prefetch: () => {},
};
const service = createService(adapter, {
  initialPath: window.location.pathname,
  onNavigate: (path: string) => ref.prefetch(path),
});
ref.prefetch = createPrefetch(service.loader);

// Hydrate the app - this registers load() boundaries in the loader
AppLayout(service).create(service);

// Switch to normal DOM mode before processing streaming data
adapter.activate();

// Connect to the stream - flushes queued data and wires up future chunks
connectStream(service, STREAM_KEY);
