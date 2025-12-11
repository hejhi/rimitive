/**
 * Client-side Hydration with Streaming Support
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * For streaming SSR with HTML:
 * - Bootstrap script queues data and swaps HTML as it arrives
 * - We set __LATTICE_HYDRATING__ immediately to prevent swaps during hydration
 * - We collect queued data BEFORE hydration so signals start with resolved values
 * - This ensures hydration matches the swapped DOM structure
 */

// FIRST: Set hydrating flag to prevent any more HTML swaps
// Any chunks that arrive now will be handled by the reactive system via signals
window.__LATTICE_HYDRATING__ = true;

import { createDOMAdapter } from '@lattice/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
  connectStreamingLoader,
  processQueuedHtmlSwaps,
} from '@lattice/ssr/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Declare the global types
declare global {
  interface Window {
    __LATTICE_DATA_QUEUE__?: Array<[string, unknown]>;
    __LATTICE_HYDRATING__?: boolean;
  }
}

// STEP 1: Collect any queued data BEFORE creating the service
// This ensures signals start with resolved values during hydration
const queuedData: Record<string, unknown> = {};
const queue = window.__LATTICE_DATA_QUEUE__;
if (queue) {
  for (const [id, data] of queue) {
    queuedData[id] = data;
  }
  // Clear the queue since we've consumed it
  queue.length = 0;
}

// STEP 2: Create the adapter stack
const domAdapter = withAsyncSupport(createDOMAdapter());
const appAdapter = createHydrationAdapter(
  createDOMHydrationAdapter(document.querySelector('.app')!),
  domAdapter
);

// STEP 3: Create service with collected data as loaderData
// This ensures load() boundaries start with resolved state
const service = createService(appAdapter, {
  loaderData: Object.keys(queuedData).length > 0 ? queuedData : undefined,
});

// STEP 4: Process any HTML swaps BEFORE hydration
// This ensures the DOM matches what hydration expects (resolved content)
processQueuedHtmlSwaps();

// STEP 5: Hydrate the app - signals already have resolved values
AppLayout(service).create(service);

// STEP 6: Switch adapter to DOM mode for future updates
appAdapter.switchToFallback();

// STEP 7: Connect streaming loader for any future chunks
connectStreamingLoader(service.loader);

console.log('[client] Hydration complete, streaming connected');

// Expose for debugging (IIFE can't export, so use global)
(window as unknown as { __LATTICE_SERVICE__: typeof service }).__LATTICE_SERVICE__ = service;
