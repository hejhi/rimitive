/**
 * Client-side Hydration with Streaming Support
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * For streaming SSR:
 * - Bootstrap script (in head) queues any data chunks that arrive before hydration
 * - connectStreamingLoader() processes queued data and wires up future chunks
 * - Data flows through signals, updating the UI reactively
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
  connectStreamingLoader,
} from '@lattice/ssr/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Create the adapter stack:
// 1. Base DOM adapter with async support for post-hydration client navigation
// 2. Hydration adapter for walking existing DOM
const domAdapter = withAsyncSupport(createDOMAdapter());

const appAdapter = createHydrationAdapter(
  // Hydration adapter for walking existing DOM
  createDOMHydrationAdapter(document.querySelector('.app')!),
  // Regular DOM adapter with async support for post-hydration navigation
  domAdapter
);

// Create service with hydrating adapter
// Note: No loaderData needed - streaming chunks arrive via __LATTICE_DATA__
const service = createService(appAdapter);

// Hydrate the app FIRST - this registers load() boundaries in the loader
AppLayout(service).create(service);

// Switch adapter to DOM mode BEFORE processing streaming data
// Otherwise, signal updates would trigger re-renders while still in hydration mode
appAdapter.switchToFallback();

// NOW connect the streaming loader - boundaries are registered, adapter is in DOM mode
// This processes any queued data and wires up future chunks
connectStreamingLoader(service.loader);

console.log('[client] Hydration complete, streaming loader connected');

// Expose for debugging (IIFE can't export, so use global)
(window as unknown as { __LATTICE_SERVICE__: typeof service }).__LATTICE_SERVICE__ = service;
