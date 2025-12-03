/**
 * Client-side hydration with routing
 *
 * Demonstrates composable islands architecture:
 * 1. Create the primitives (signals, adapter, view)
 * 2. Wire them together with createIslandsApp
 * 3. Add router at app layer
 */
import { createIslandsApp } from '@lattice/islands';
import {
  createDOMHydrationAdapter,
  createIslandsAdapter,
} from '@lattice/islands/client';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createViewApi } from '@lattice/view/presets/core';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createRouter } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';
import {
  buildAppContext,
  setServiceGetter,
  type AppContext,
  type Service,
} from './service.js';

// 1. Create the primitives
const container = document.querySelector('.app') as HTMLElement;
const signals = createSignalsApi();
const adapter = createIslandsAdapter(
  createDOMHydrationAdapter(container),
  createDOMAdapter()
);
const view = createViewApi<DOMAdapterConfig>(adapter, signals);

// 2. Wire them for islands
const app = createIslandsApp<AppContext>({
  signals,
  adapter,
  view,
  context: () => buildAppContext(window.location.href),
});

// 3. Add router at app layer
const router = createRouter<DOMAdapterConfig>(app.service, {
  initialPath: location.pathname + location.search + location.hash,
});

// Wrap navigate to also update context for islands
const navigate = (path: string) => {
  router.navigate(path);
  app.updateContext();
};

// Handle browser back/forward - update context when route changes
window.addEventListener('popstate', () => {
  app.updateContext();
});

// Build full service with router methods
const service: Service = {
  ...app.service,
  navigate,
  currentPath: router.currentPath,
};

// Configure service lookup to use singleton
setServiceGetter(() => service);

// Mount routes - hydrates existing SSR'd DOM, then auto-switches renderer
app.mount(router.mount(appRoutes), service);

// Hydrate islands
app.hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, navigate };
