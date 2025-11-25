/**
 * Client-side hydration with routing
 *
 * Composes the client service, hydrates islands, and mounts routes.
 */
import { createDOMHydrator } from '@lattice/islands/client';
import { createClientApi, router, mount, service } from './service-client.js';
import { createRouteContent } from './routes.js';
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

// Mount routes into the main content area
const routeContainer = document.querySelector('.main-content');
if (routeContainer) {
  // Get svc with navigate for createRouteContent
  const svcWithNav = { ...service.view, navigate: router.navigate };
  const App = createRouteContent(router, svcWithNav);
  const routeRef = mount(App);

  // Replace SSR'd route content with reactive client version
  routeContainer.innerHTML = '';
  if (routeRef.element) {
    routeContainer.appendChild(routeRef.element as Node);
  }
}
