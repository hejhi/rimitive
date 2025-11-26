/**
 * Client-side hydration with routing
 *
 * Composes the client service, hydrates islands, and mounts routes.
 */
import { createDOMHydrator } from '@lattice/islands/client';
import { createClientApi, router, mount, service } from './service-client.js';
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';

// API factory for hydrator - wraps createClientApi and adds navigate
const createApi = (
  renderer: Parameters<typeof createClientApi>[0],
  signals: Parameters<typeof createClientApi>[1]
) => ({
  ...createClientApi(renderer, signals),
  navigate: router.navigate,
});

// Create hydrator and hydrate islands
const hydrator = createDOMHydrator(createApi, service.signals, mount);
hydrator.hydrate(ProductFilter, Navigation);

// Mount routes - replace the SSR'd app with the reactive client version
const ssrApp = document.querySelector('.app');

if (ssrApp?.parentElement) {
  // Mount the route tree using the router
  const App = router.mount(appRoutes);
  const routeRef = mount(App);

  // Replace SSR'd app with reactive client version
  if (routeRef.element) {
    ssrApp.parentElement.replaceChild(routeRef.element, ssrApp);
  }
}
