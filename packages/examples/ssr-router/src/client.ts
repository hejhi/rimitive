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
import { setClientRouter } from './service.js';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Create base app (signals + views + hybrid renderer)
const { service, mount, createApi, signals } = createSSRClientApp({
  container: document.querySelector('.app'),
});

// Add router at app layer (explicit generic for type inference)
const router = createRouter<DOMRendererConfig>(service, {
  initialPath: location.pathname + location.search + location.hash,
});

// Set router reference for islands that use router.useCurrentPath
setClientRouter(router);

// Service with navigate for connected components
const serviceWithNav = {
  ...service,
  navigate: router.navigate,
  currentPath: router.currentPath,
};

// Mount with service that includes navigate
const mountWithNav = (spec: Parameters<typeof mount>[0]) => {
  return spec.create(serviceWithNav);
};

// Mount routes - hydrates existing SSR'd DOM, then auto-switches renderer
mount(router.mount(appRoutes));

// API factory that includes router methods for islands
const createApiWithRouter: typeof createApi = (renderer, sigs) => {
  const { api, createElementScope } = createApi(renderer, sigs);
  return {
    api: {
      ...api,
      navigate: router.navigate,
      currentPath: router.currentPath,
    },
    createElementScope,
  };
};

// Hydrate islands
const hydrator = createDOMHydrator(createApiWithRouter, signals, mountWithNav);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);

// Export for islands that need router access
export { router };
