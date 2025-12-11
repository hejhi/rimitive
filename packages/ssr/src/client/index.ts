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
 * Window globals for streaming SSR.
 * These are set by the bootstrap script (included via renderToStream's headScript)
 * and used by connectStreamingLoader and processQueuedHtmlSwaps.
 */
declare global {
  interface Window {
    __LATTICE_DATA_QUEUE__?: Array<[string, unknown]>;
    __LATTICE_HTML_QUEUE__?: string[];
    __LATTICE_DATA__?: (id: string, data: unknown) => void;
    __LATTICE_SWAP__?: (id: string) => void;
    __LATTICE_LOADER__?: Loader;
    __LATTICE_HYDRATING__?: boolean;
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

/**
 * Process any HTML swaps that were queued before hydration completed.
 *
 * The bootstrap script queues swap IDs when the placeholder element isn't
 * found yet (e.g., HTML chunk arrived before hydration). Call this after
 * hydration completes and the DOM is ready.
 *
 * @example
 * ```ts
 * // Client
 * import { connectStreamingLoader, processQueuedHtmlSwaps } from '@lattice/ssr/client';
 *
 * // Hydrate the app
 * AppLayout(service).create(service);
 *
 * // Switch to DOM mode
 * appAdapter.switchToFallback();
 *
 * // Connect streaming and process queued swaps
 * connectStreamingLoader(service.loader);
 * processQueuedHtmlSwaps();
 * ```
 */
export function processQueuedHtmlSwaps(): void {
  const queue = window.__LATTICE_HTML_QUEUE__;
  if (!queue || queue.length === 0) return;

  for (const id of queue) {
    const template = document.getElementById(`S:${id}`);
    if (!template) continue;

    // Find comment markers: <!--async:id--> and <!--/async:id-->
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    let startMarker: Comment | null = null;
    let endMarker: Comment | null = null;
    let node: Comment | null;

    while ((node = walker.nextNode() as Comment | null)) {
      if (node.nodeValue === `async:${id}`) startMarker = node;
      else if (node.nodeValue === `/async:${id}`) {
        endMarker = node;
        break;
      }
    }

    if (startMarker && endMarker) {
      const parent = startMarker.parentNode;
      if (parent) {
        // Remove all nodes between markers
        while (startMarker.nextSibling && startMarker.nextSibling !== endMarker) {
          parent.removeChild(startMarker.nextSibling);
        }
        // Insert template content before end marker
        const content = (template as HTMLTemplateElement).content.cloneNode(true);
        parent.insertBefore(content, endMarker);
        template.remove();
      }
    }
  }

  // Clear the queue
  queue.length = 0;
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
