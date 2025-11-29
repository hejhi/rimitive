/**
 * Client-side hydration with routing
 *
 * Uses createIslandsApp for a clean, unified API.
 */
import { createIslandsApp } from '@lattice/islands';
import { createRouter, type ViewApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';
import { buildAppContext, type AppContext } from './service.js';

// Create islands app with container (client mode)
const app = createIslandsApp<AppContext>({
  container: document.querySelector('.app') as HTMLElement,
  context: () => buildAppContext(window.location.href),
});

// Add router at app layer
// Note: cast needed as router expects ViewApi shape, service has it structurally
const router = createRouter<DOMRendererConfig>(
  app.service as ViewApi<DOMRendererConfig>,
  { initialPath: location.pathname + location.search + location.hash }
);

// Wrap navigate to also update context for islands
const navigate = (path: string) => {
  router.navigate(path);
  app.updateContext();
};

// Service with navigate for connected components
const serviceWithNav = {
  ...app.service,
  navigate,
  currentPath: router.currentPath,
};

// Mount routes - hydrates existing SSR'd DOM, then auto-switches renderer
// Pass serviceWithNav so navigate is available throughout the route tree
app.mount(router.mount(appRoutes), serviceWithNav);

// Hydrate islands
app.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, navigate };
