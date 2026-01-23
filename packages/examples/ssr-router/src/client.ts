/**
 * Client-side Hydration (Basic Sync)
 *
 * The hydrating adapter walks the SSR DOM instead of creating new elements.
 * This means match() wires up reactivity to existing content, and future
 * navigations swap content normally.
 *
 * This is the simplest hydration setup - no async data.
 * For async data, see the ssr-router-async example.
 */
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
} from '@rimitive/ssr/client';

import { createService, type Service } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Create the adapter stack:
// 1. Hydration adapter for walking existing DOM
// 2. Regular DOM adapter for post-hydration updates
const appAdapter = createHydrationAdapter(
  createDOMHydrationAdapter(document.querySelector('.app')!),
  createDOMAdapter()
);

// Create service with hydrating adapter
const service: Service = createService(appAdapter);

// Hydrate the app with the service, wiring up reactivity
AppLayout(service).create(service);

// Switch adapter to DOM mode for future reactive updates
appAdapter.switchToFallback();

// Export for debugging
export { service };
