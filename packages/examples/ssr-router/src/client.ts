/**
 * Client-side Hydration
 *
 * Simple flow:
 * 1. Create router (reactive state)
 * 2. Create service with router's navigate/currentPath
 * 3. Hydrate AppLayout (walks existing DOM, wires up reactivity)
 * 4. Hydrate islands
 *
 * The key insight: We use the hydrating adapter for the whole app, not just islands.
 * This means match() inside AppLayout walks the existing SSR DOM on first render,
 * then switches to normal DOM operations for subsequent navigation.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import {
  createDOMHydrator,
  createDOMHydrationAdapter,
  createIslandsAdapter,
  createHydrationSvc,
} from '@lattice/islands/client';
import { createRouter } from '@lattice/router';

import { routes } from './routes.js';
import { createBaseService, type Service } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

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

// Create hydrating service wrapper (queues effects until hydration completes)
const { hydratingSvc, activate } = createHydrationSvc(service);

// Hydrate the app - walks existing DOM instead of creating new elements
AppLayout(hydratingSvc)().create(hydratingSvc);

// Switch adapter to fallback mode for future reactive updates
appAdapter.switchToFallback();

// Activate queued effects now that hydration is complete
activate(service);

// Service factory for island hydration
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandBaseSvc = createBaseService(islandAdapter);

  const islandSvc: Service = {
    ...islandBaseSvc,
    navigate: router.navigate,
    currentPath: router.currentPath,
    matches: router.matches,
    use: (component) => component(islandSvc),
  };

  const scopes = createScopes({ baseEffect: islandSvc.effect });

  return {
    svc: islandSvc,
    createElementScope: scopes.createElementScope,
  };
};

// Mount function for client-side fallback rendering
const mount = (spec: { create: (svc: Service) => { element: unknown } }) => ({
  element: spec.create(service),
});

// Hydrate islands
const hydrator = createDOMHydrator(createSvc, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for debugging
export { router, service };
