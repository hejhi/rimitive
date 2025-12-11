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
 * Streaming SSR uses a user-defined proxy key (e.g., '__APP_STREAM__')
 * via createStreamingBootstrap() - no hardcoded globals needed.
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
 * Streaming proxy interface - matches what createStreamingBootstrap() creates.
 * The proxy queues data until a loader connects, then forwards directly.
 */
export type StreamingProxy = {
  queue: Array<[string, unknown]>;
  loader: Loader | null;
  push: (id: string, data: unknown) => void;
  connect: (loader: Loader) => void;
};

/**
 * Connect a loader to a streaming proxy.
 *
 * Call this after hydration to connect the loader to the streaming proxy
 * created by createStreamingBootstrap(). The proxy flushes its queue
 * and forwards future chunks directly to the loader.
 *
 * @param loader - The loader instance from your service
 * @param streamKey - The window property name used in createStreamingBootstrap()
 *
 * @example
 * ```ts
 * // Server used: createStreamingBootstrap('__APP_STREAM__')
 *
 * // Client
 * import { connectStreamingLoader } from '@lattice/ssr/client';
 *
 * const service = createService(appAdapter);
 * AppLayout(service).create(service);
 * appAdapter.switchToFallback();
 *
 * // Connect to the streaming proxy - same key as server
 * connectStreamingLoader(service.loader, '__APP_STREAM__');
 * ```
 */
export function connectStreamingLoader(loader: Loader, streamKey: string): void {
  const proxy = (window as unknown as Record<string, unknown>)[streamKey] as StreamingProxy | undefined;
  if (proxy && typeof proxy.connect === 'function') {
    proxy.connect(loader);
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
