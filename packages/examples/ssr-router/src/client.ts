/**
 * Client-side hydration with routing
 *
 * Uses the new hydrateApp API for clean client initialization.
 * Hydrates islands and mounts reactive routes.
 */
import { hydrateApp } from '@lattice/islands/client';
import { service, router } from './service.js';
import { createRouteContent } from './routes.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';

hydrateApp({
  service,
  router, // Pass the singleton router so islands and routes share the same state
  createApp: createRouteContent,
  islands: [ProductFilter, Navigation],
  routeContainer: '.main-content',
});
