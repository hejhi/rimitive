/**
 * Client-side Hydration
 *
 * Simple flow:
 * 1. Create router (reactive state)
 * 2. Create service with router's navigate/currentPath
 * 3. Render AppLayout (uses match() which reacts to router.matches)
 * 4. Hydrate islands
 *
 * Note: On initial load, SSR content is replaced with client-rendered content.
 * This is fine because match() renders the same content based on current path.
 * Future: Could hydrate instead of replace if needed.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMHydrator } from '@lattice/islands/client';
import { createRouter } from '@lattice/router';

import { routes } from './routes.js';
import { createBaseService, type Service } from './service.js';
import { AppLayout } from './layouts/AppLayout.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Create DOM adapter and base service
const domAdapter = createDOMAdapter();
const baseSvc = createBaseService(domAdapter);

// Create router - just reactive state
const router = createRouter(
  { signal: baseSvc.signal, computed: baseSvc.computed },
  routes
);

// Build full service with router methods
const service: Service = {
  ...baseSvc,
  navigate: router.navigate,
  currentPath: router.currentPath,
};

// Render the app
const appSpec = AppLayout(service, router);
const appRef = appSpec.create(service);

// Mount to DOM
const container = document.querySelector('.app');
if (container && appRef.element) {
  container.replaceWith(appRef.element as Node);
}

// Service factory for island hydration
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandBaseSvc = createBaseService(islandAdapter);

  const islandSvc: Service = {
    ...islandBaseSvc,
    navigate: router.navigate,
    currentPath: router.currentPath,
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
