/**
 * Client-side hydration with routing
 *
 * The service-client creates a hybrid renderer that:
 * 1. Starts in hydration mode (adopts SSR'd DOM)
 * 2. Switches to regular DOM mode after initial mount
 *
 * This enables true islands architecture - layout stays static,
 * only interactive parts (islands) are hydrated.
 */
import { createDOMHydrator } from '@lattice/islands/client';
import {
  createClientApi,
  router,
  mount,
  switchToFallback,
  service,
} from './service-client.js';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';

// Mount routes first - uses hydrating renderer to adopt existing SSR'd DOM
const App = router.mount(appRoutes);
mount(App);

// Switch to fallback renderer for future navigation
switchToFallback();

// API factory for island hydrator - adds navigate to the API
const createApi = (
  renderer: Parameters<typeof createClientApi>[0],
  signals: Parameters<typeof createClientApi>[1]
) => ({
  ...createClientApi(renderer, signals),
  navigate: router.navigate,
  currentPath: router.currentPath,
});

// Create hydrator and hydrate islands
const hydrator = createDOMHydrator(createApi, service.signals, mount);
hydrator.hydrate(ProductFilter, Navigation, AddToCart);
