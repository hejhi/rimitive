/**
 * Client-side Hydration
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * For async fragments (load()):
 * - During hydration: withHydrationData injects SSR data before attach
 * - After hydration: withAsyncSupport triggers fetching on attach
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
  withHydrationData,
  createWindowHydrationStore,
  clearWindowHydrationData,
} from '@lattice/ssr/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Create hydration data store from window.__LATTICE_HYDRATION_DATA__
const hydrationStore = createWindowHydrationStore();
const hasHydrationData = hydrationStore.has('stats-page'); // Check if any data exists

if (hasHydrationData) {
  console.log('[Lattice] Hydrating with SSR async data');
}

// Create the adapter stack:
// 1. Base DOM adapter
// 2. withAsyncSupport - triggers async fragments on attach (for client nav)
// 3. withHydrationData - injects SSR data before attach (for initial hydration)
const domAdapter = withAsyncSupport(createDOMAdapter());

const appAdapter = createHydrationAdapter(
  // Hydration adapter with data injection
  withHydrationData(
    createDOMHydrationAdapter(document.querySelector('.app')!),
    hydrationStore
  ),
  // Regular DOM adapter with async support for post-hydration
  domAdapter
);

// Create service with hydrating adapter
const service = createService(appAdapter);

// Hydrate the app with the service and renderer, wiring up reactivity
AppLayout(service).create(service);

// Switch adapter to DOM mode for future reactive updates
appAdapter.switchToFallback();

// Clear hydration data after hydration is complete to free memory
clearWindowHydrationData();

// Export for debugging
export { service };
