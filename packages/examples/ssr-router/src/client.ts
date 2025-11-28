/**
 * Client-side hydration with routing
 *
 * Uses the SSR client preset for hydration setup,
 * then composes the router at the app layer.
 */
import { createSSRClientApp } from '@lattice/islands/presets/ssr-client';
import { createDOMHydrator } from '@lattice/islands/client';
import { createRouter } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Create base app (signals + views + hybrid renderer + request context)
const { service, mount, createApi, signals, updateRequestContext } =
  createSSRClientApp({
    container: document.querySelector('.app'),
  });

// Add router at app layer
const router = createRouter<DOMRendererConfig>(service, {
  initialPath: location.pathname + location.search + location.hash,
});

// Wrap navigate to also update request context for islands
const navigate = (path: string) => {
  router.navigate(path);
  updateRequestContext();
};

// Service with navigate for connected components
const serviceWithNav = {
  ...service,
  navigate,
  currentPath: router.currentPath,
};

// Mount routes - hydrates existing SSR'd DOM, then auto-switches renderer
// Pass serviceWithNav so navigate is available throughout the route tree
mount(router.mount(appRoutes), serviceWithNav);

// API factory that includes router methods for islands
const createApiWithRouter: typeof createApi = (renderer, sigs) => {
  const { api, createElementScope } = createApi(renderer, sigs);
  return {
    api: {
      ...api,
      navigate,
      currentPath: router.currentPath,
    },
    createElementScope,
  };
};

// Hydrate islands (islands get their API from createApiWithRouter, not the route service)
const hydrator = createDOMHydrator(createApiWithRouter, signals, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, navigate };
