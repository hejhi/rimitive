/**
 * Client-side hydration with routing
 *
 * SSR content is preserved on initial load. The reactive route tree is only
 * attached on first navigation, replacing the static SSR content.
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

// Create DOM adapter and base service
const domAdapter = createDOMAdapter();
const baseSvc = createBaseService(domAdapter);

// Create router
const router = createRouter(baseSvc);

// Build full service with router methods
const service: Service = {
  ...baseSvc,
  navigate: router.navigate,
  currentPath: router.currentPath,
};

// Track the initial path - SSR already rendered this
const initialPath = location.pathname + location.search + location.hash;
let routeTreeAttached = false;

// Prepare route tree (but don't attach yet)
const routeSpec = router.mount(appRoutes);

// Get container
const container = document.querySelector('.app') as HTMLElement;

// Function to attach reactive route tree (called on first navigation)
function attachRouteTree() {
  if (routeTreeAttached) return;
  routeTreeAttached = true;

  // Render the reactive route tree
  const appRef = router.renderApp(routeSpec);

  // Replace SSR content with reactive tree
  if (container && appRef.element) {
    container.replaceChildren(appRef.element as Node);
  }
}

// Wrap navigate to attach route tree on first navigation
const originalNavigate = router.navigate;
const wrappedNavigate = (path: string) => {
  attachRouteTree();
  originalNavigate(path);
};

// Update service with wrapped navigate
const serviceWithWrappedNav: Service = {
  ...service,
  navigate: wrappedNavigate,
};

// Handle popstate (back/forward) - also needs to attach route tree
window.addEventListener('popstate', () => {
  const newPath = location.pathname + location.search + location.hash;
  if (newPath !== initialPath) {
    attachRouteTree();
  }
});

// Service factory for island hydration
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandBaseSvc = createBaseService(islandAdapter);

  const islandSvc: Service = {
    ...islandBaseSvc,
    navigate: wrappedNavigate,
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
  element: spec.create(serviceWithWrappedNav),
});

// Hydrate islands
const hydrator = createDOMHydrator(createSvc, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, service };
