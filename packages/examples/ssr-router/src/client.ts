/**
 * Client-side hydration with routing
 *
 * Uses the client preset for service creation.
 */
import { appRoutes } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { AddToCart } from './islands/AddToCart.js';
import { buildAppContext, setServiceGetter } from './service.js';
import { createClientApp } from './preset.client.js';

// Create client app with routing
const { service, mount, hydrate, router, navigate } = createClientApp({
  container: document.querySelector('.app') as HTMLElement,
  buildContext: () => buildAppContext(window.location.href),
  routes: appRoutes,
});

// Configure service lookup to use singleton
setServiceGetter(() => service);

// Mount routes and hydrate islands
mount();
hydrate(ProductFilter, Navigation, AddToCart);

// Export for other modules if needed
export { router, navigate };
