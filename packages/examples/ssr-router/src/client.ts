/**
 * Client-side Hydration
 *
 * Simple flow:
 * 1. Create hydrating adapter that walks existing DOM
 * 2. Create router (reactive state)
 * 3. Hydrate AppLayout (walks existing DOM, wires up reactivity)
 * 4. Switch to regular DOM adapter for future updates
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
import { createRouter } from '@lattice/router';

import { routes } from './routes.js';
import { createBaseService, type Service } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';

// Find the app container (SSR-rendered content)
const container = document.querySelector('.app') as HTMLElement;

// Create hydrating adapter that walks existing DOM, then switches to regular DOM ops
const domAdapter = createDOMAdapter();
const hydrationAdapter = createDOMHydrationAdapter(container);
const appAdapter = createIslandsAdapter(hydrationAdapter, domAdapter);

// Create base service with the hydrating adapter
const baseSvc = createBaseService(appAdapter);

// Create router - just reactive state
const router = createRouter(
  { signal: baseSvc.signal, computed: baseSvc.computed },
  routes
);

// Build full service with router methods and use helper
const service: Service = {
  ...baseSvc,
  navigate: router.navigate,
  currentPath: router.currentPath,
  matches: router.matches,
  use: (component) => component(service),
};

// Hydrate the app - walks existing DOM, wires up reactivity
AppLayout(service)().create(service);

// Switch adapter to fallback mode for future reactive updates
appAdapter.switchToFallback();

// Export for debugging
export { router, service };
