/**
 * Client-side Hydration
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * For async fragments (load()):
 * - During hydration: data is extracted from fragment markers (base64 encoded)
 * - After hydration: withAsyncSupport triggers fetching on attach for new content
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
} from '@lattice/ssr/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Create the adapter stack:
// 1. Base DOM adapter with async support for post-hydration client navigation
// 2. Hydration adapter automatically extracts data from fragment markers
const domAdapter = withAsyncSupport(createDOMAdapter());

const appAdapter = createHydrationAdapter(
  // Hydration adapter - extracts async data from fragment markers automatically
  createDOMHydrationAdapter(document.querySelector('.app')!),
  // Regular DOM adapter with async support for post-hydration navigation
  domAdapter
);

// Create service with hydrating adapter
const service = createService(appAdapter);

// Hydrate the app with the service and renderer, wiring up reactivity
AppLayout(service).create(service);

// Switch adapter to DOM mode for future reactive updates
appAdapter.switchToFallback();

// Export for debugging
export { service };
