/**
 * Client-side hydration with routing
 *
 * Demonstrates composable islands architecture:
 * 1. Create the primitives (signals, renderer, view)
 * 2. Wire them together with createIslandsApp
 * 3. Add router at app layer
 */
import { createIslandsApp } from '@lattice/islands';
import {
  createDOMHydrationRenderer,
  createIslandsRenderer,
} from '@lattice/islands/client';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createViewApi } from '@lattice/view/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createRouter, type ViewApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';
import { buildAppContext, type AppContext } from './service.js';

// 1. Create the primitives
const container = document.querySelector('.app') as HTMLElement;
const signals = createSignalsApi();
const renderer = createIslandsRenderer(
  createDOMHydrationRenderer(container),
  createDOMRenderer()
);
const view = createViewApi<DOMRendererConfig>(renderer, signals);

// 2. Wire them for islands
const app = createIslandsApp<AppContext>({
  signals,
  renderer,
  view,
  context: () => buildAppContext(window.location.href),
});

// 3. Add router at app layer
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
