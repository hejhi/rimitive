/**
 * Client Module
 *
 * Client-side utilities for SSR hydration.
 *
 * Async fragment data is managed by createLoader() - pass initial data
 * from window.__LATTICE_DATA__ (or similar) to seed the loader on the client.
 */

import type { Loader } from '@lattice/view/load';

// =============================================================================
// Window Globals for SSR
// =============================================================================

/**
 * Window globals for SSR.
 *
 * Non-streaming SSR uses __LATTICE_DATA__ as a static object containing
 * loader data serialized by the server.
 *
 * Streaming SSR uses a user-defined stream key (e.g., '__APP_STREAM__')
 * via createStreamWriter() - no hardcoded globals needed.
 */
declare global {
  interface Window {
    /** Non-streaming SSR: static data object from server */
    __LATTICE_DATA__?: Record<string, unknown>;
  }
}

// =============================================================================
// Streaming SSR Client Support
// =============================================================================

/**
 * Stream receiver interface - matches what stream.bootstrap() creates.
 * The receiver queues data until a loader connects, then forwards directly.
 */
export type StreamReceiver = {
  push: (id: string, data: unknown) => void;
  connect: (loader: Loader) => void;
};

/**
 * Connect a loader to a stream receiver.
 *
 * Call this after hydration to connect the loader to the stream receiver
 * created by stream.bootstrap(). The receiver flushes its queue
 * and forwards future chunks directly to the loader.
 *
 * @param loader - The loader instance from your service
 * @param streamKey - The window property name (stream.key)
 *
 * @example
 * ```ts
 * // Server: const stream = createStreamWriter('__APP_STREAM__');
 * // Server: res.write(stream.bootstrap());
 *
 * // Client
 * import { connectStream } from '@lattice/ssr/client';
 *
 * const service = createService(appAdapter);
 * AppLayout(service).create(service);
 * appAdapter.switchToFallback();
 *
 * // Connect to the stream - same key as server
 * connectStream(service.loader, '__APP_STREAM__');
 * ```
 */
export function connectStream(loader: Loader, streamKey: string): void {
  const receiver = (window as unknown as Record<string, unknown>)[streamKey] as StreamReceiver | undefined;
  if (receiver && typeof receiver.connect === 'function') {
    receiver.connect(loader);
  }
}

// =============================================================================
// Adapters
// =============================================================================

export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export { createHydrationAdapter } from '../adapters/hydration';

// Async fragment utilities (client-side)
export {
  triggerAsyncFragment,
  collectAsyncFragments,
  isAsyncFragment,
  ASYNC_FRAGMENT,
} from '../deps/async-fragments';
export type { AsyncFragment } from '../deps/async-fragments';

// Adapter wrapper for client-side rendering (non-hydration)
export { withAsyncSupport } from '../deps/hydration-adapters';

// Types
export { HydrationMismatch } from '../types';
