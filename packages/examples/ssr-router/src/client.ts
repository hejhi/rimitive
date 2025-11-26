/**
 * Client-side hydration with routing
 *
 * Islands are hydrated (selective hydration).
 * Routes use the SSR'd content for initial load, then swap on navigation.
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

// For routing: keep SSR'd content, set up navigation to swap routes
const mainContent = document.querySelector('.main-content');

if (mainContent) {
  // Subscribe to route changes and swap content on navigation
  // The first navigation will replace SSR'd content with client-rendered route
  let isFirstRender = true;

  service.signals.effect(() => {
    // Track current path
    void router.currentPath();

    // Skip initial render - SSR content is already correct
    if (isFirstRender) {
      isFirstRender = false;
      return;
    }

    // Mount the full route tree and extract just the route content
    const App = router.mount(appRoutes);
    const appRef = mount(App);

    // Find the main-content inside the new app
    const newMainContent = appRef.element?.querySelector('.main-content');

    if (newMainContent) {
      // Replace content
      mainContent.innerHTML = '';
      while (newMainContent.firstChild) {
        mainContent.appendChild(newMainContent.firstChild);
      }
    }
  });
}
