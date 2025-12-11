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
// Streaming SSR Client Support
// =============================================================================

/**
 * Window globals for SSR.
 *
 * __LATTICE_DATA__ has two forms:
 * - Non-streaming SSR: Object with pre-loaded data (set by server before hydration)
 * - Streaming SSR: Function to receive streamed chunks (set by bootstrap script)
 *
 * The other globals are only used for streaming SSR.
 */
declare global {
  interface Window {
    /** Streaming: queue for data chunks that arrive before hydration */
    __LATTICE_DATA_QUEUE__?: Array<[string, unknown]>;
    /** Non-streaming: static data object. Streaming: function to receive chunks */
    __LATTICE_DATA__?: Record<string, unknown> | ((id: string, data: unknown) => void);
    /** Streaming: loader instance for direct data delivery */
    __LATTICE_LOADER__?: Loader;
  }
}

/**
 * Connect a loader to receive streamed data chunks.
 *
 * Call this during client hydration AFTER creating your loader and
 * AFTER switching the adapter to DOM mode (if using hydration).
 *
 * The bootstrap script (from renderToStream's headScript) queues any data
 * that arrives before this is called. This function processes the queue
 * and wires up future chunks to go directly to the loader.
 *
 * @example
 * ```ts
 * // Client
 * import { connectStreamingLoader } from '@lattice/ssr/client';
 *
 * // Hydrate the app
 * AppLayout(service).create(service);
 *
 * // Switch to DOM mode
 * appAdapter.switchToFallback();
 *
 * // Connect streaming - processes queued data and wires up future chunks
 * connectStreamingLoader(service.loader);
 * ```
 */
export function connectStreamingLoader(loader: Loader): void {
  // Process any queued data from chunks that arrived before hydration
  const queue = window.__LATTICE_DATA_QUEUE__;
  if (queue) {
    for (const [id, data] of queue) {
      loader.setData(id, data);
    }
    // Clear the queue
    queue.length = 0;
  }

  // Wire up future chunks to go directly to the loader
  window.__LATTICE_LOADER__ = loader;
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
