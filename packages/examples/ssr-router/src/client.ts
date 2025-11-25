/**
 * Client-side hydration with routing
 *
 * Sets up client-side navigation and hydrates islands.
 * Only mounts route content, preserving hydrated islands in the layout.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { composeFrom } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createDOMHydrationRenderer } from '@lattice/islands/renderers/dom-hydration';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { service, router, mount as mountApp } from './service-client.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { createRouteContent } from './routes.js';

const { signals, view } = service;
const { navigate } = router;

// Create API factory for hydrator
function createFullAPI(
  renderer: ReturnType<typeof createIslandsRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = composeFrom(defaultExtensions<DOMRendererConfig>(), helpers);

  // Add navigate to the API for Link component to use
  return { ...signalsApi, ...views, navigate };
}

// Mount function for fallback rendering
function mount<T>(spec: {
  create: (api: ReturnType<typeof createFullAPI>) => T;
}): T {
  const renderer = createIslandsRenderer(
    createDOMHydrationRenderer(document.body),
    createDOMRenderer()
  );
  const api = createFullAPI(renderer, signals);
  return spec.create(api);
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate islands first (Navigation in navbar will survive)
hydrator.hydrate(ProductFilter, Navigation);

// Mount just the route content into .main-content
// This preserves the hydrated layout (navbar with Navigation island)
const mainContent = document.querySelector('.main-content');
if (mainContent) {
  // Create route content using el from service
  const RouteContent = createRouteContent(router, view.el);
  const routeRef = mountApp(RouteContent);

  // Replace the SSR'd route content with reactive client version
  mainContent.innerHTML = '';
  mainContent.appendChild(routeRef.element as HTMLElement);
}
