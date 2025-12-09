/**
 * Client-side Hydration
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createIslandsAdapter,
} from '@lattice/islands/client';

import { createService } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

const appAdapter = createIslandsAdapter(
  // Create hydrating adapter that walks and binds to existing DOM
  createDOMHydrationAdapter(document.querySelector('.app')!),
  // Then switche to regular DOM adapter
  createDOMAdapter()
);

// Create service with hydrating adapter
const service = createService(appAdapter);

// Hydrate the app with the service and renderer, wiring up reactivity
AppLayout(service).create(service);

// Switch adapter to DOM mode for future reactive updates
// This is all sync so we can just write this here
appAdapter.switchToFallback();

// Export for debugging
export { service };
