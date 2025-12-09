/**
 * Client-side hydration with routing
 *
 * Uses the module composition pattern with DOM adapter.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMHydrator, setClientContext } from '@lattice/islands/client';
import { createRouter } from '@lattice/router';

import { appRoutes } from './routes.js';
import {
  createBaseService,
  buildAppContext,
  setServiceGetter,
  type Service,
  type AppContext,
} from './service.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Create main DOM adapter and base service
const domAdapter = createDOMAdapter();
const baseSvc = createBaseService(domAdapter);

// Create router
const router = createRouter<DOMAdapterConfig>(baseSvc, {
  initialPath: location.pathname + location.search + location.hash,
});

// Mutable context for navigation updates
let currentContext: AppContext = buildAppContext(window.location.href);

// Build full service with router methods
const service: Service = {
  ...baseSvc,
  navigate: (path: string) => {
    router.navigate(path);
    // Update context after navigation
    currentContext = buildAppContext(window.location.href);
  },
  currentPath: router.currentPath,
};

// Configure service lookup to use singleton
setServiceGetter(() => service);

// Configure island context getter
setClientContext(() => currentContext);

// Handle browser back/forward
window.addEventListener('popstate', () => {
  currentContext = buildAppContext(window.location.href);
});

// Service factory for hydrator - creates per-island service with hydrating adapter
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandBaseSvc = createBaseService(islandAdapter);

  // Build island service with router methods from main service
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

// Mount routes (renders on client side)
router.mount(appRoutes);
const container = document.querySelector('.app');
if (container) {
  // For SSR + hydration, the HTML is already there
  // Just hydrate the interactive islands
}

// Create hydrator and hydrate islands
const hydrator = createDOMHydrator(createSvc, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, service };
