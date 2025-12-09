/**
 * Client-side hydration with routing
 *
 * Uses the module composition pattern with DOM adapter.
 * Islands receive the service which includes currentPath for URL-based reactivity.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMHydrator } from '@lattice/islands/client';
import { createRouter } from '@lattice/router';

import { appRoutes } from './routes.js';
import { createBaseService, type Service } from './service.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Create main DOM adapter and base service
const domAdapter = createDOMAdapter();
const baseSvc = createBaseService(domAdapter);

// Create router
const router = createRouter(baseSvc);

// Build full service with router methods
// Islands use currentPath directly - no separate "context" needed
const service: Service = {
  ...baseSvc,
  navigate: router.navigate,
  currentPath: router.currentPath,
};

// Service factory for hydrator - creates per-island service with hydrating adapter
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandBaseSvc = createBaseService(islandAdapter);

  // Build island service with router methods from main service
  // currentPath is shared across all islands for reactive URL tracking
  const islandSvc: Service = {
    ...islandBaseSvc,
    navigate: service.navigate,
    currentPath: service.currentPath,
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

// Mount routes and render the reactive route tree
const routeSpec = router.mount(appRoutes);
const appRef = router.renderApp(routeSpec);
const container = document.querySelector('.app');

// Replace SSR content with reactive client-side route tree
if (container && appRef.element) container.replaceChildren(appRef.element);

// Create hydrator and hydrate islands
const hydrator = createDOMHydrator(createSvc, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, service };
