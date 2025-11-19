/**
 * Client-side hydration with routing
 *
 * Sets up client-side navigation and hydrates islands.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { createApi } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createDOMHydrationRenderer } from '@lattice/islands/renderers/dom-hydration';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { signals } from './api.js';
import { ProductFilter } from './islands/ProductFilter.js';
import { Navigation } from './islands/Navigation.js';
import { Home } from './pages/Home.js';
import { About } from './pages/About.js';
import { Products } from './pages/Products.js';

// Create client-side current path signal
const currentPath = signals.signal(window.location.pathname);

// Navigate function that updates URL and current path
const navigate = (path: string) => {
  if (path === currentPath()) return;

  // Update browser URL
  window.history.pushState(null, '', path);

  // Update reactive signal (this triggers page re-render)
  currentPath(path);
};

// Listen for browser back/forward buttons
window.addEventListener('popstate', () => {
  currentPath(window.location.pathname);
});

// Create API factory for hydrator (includes navigate and currentPath for islands)
function createFullAPI(
  renderer: ReturnType<typeof createIslandsRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), helpers);

  // Add navigate and currentPath to the API so islands and Link can use them
  return { ...signalsApi, ...views, navigate, currentPath };
}

// Mount function for fallback rendering
function mount<T>(spec: { create: (api: ReturnType<typeof createFullAPI>) => T }): T {
  const renderer = createIslandsRenderer(
    createDOMHydrationRenderer(document.body),
    createDOMRenderer()
  );
  const api = createFullAPI(renderer, signals);
  return spec.create(api);
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate islands
hydrator.hydrate(ProductFilter, Navigation);

// Set up client-side page switching
const mainContent = document.querySelector('.main-content');

if (mainContent) {
  // Create a client-side renderer for page navigation
  const pageRenderer = createDOMRenderer();
  const pageHelpers = defaultHelpers<DOMRendererConfig>(pageRenderer, signals);
  const pageViews = createApi(defaultExtensions<DOMRendererConfig>(), pageHelpers);
  const pageApi = {
    ...signals,
    ...pageViews,
    navigate,
  };

  // Watch for route changes and re-render page content
  signals.effect(() => {
    const path = currentPath();

    // Build route context for connected components
    const routeContext = {
      children: null,
      params: signals.computed(() => ({})),
    };

    // Determine which page to render
    // Connected components need: call with user props first, then route context
    const pageSpec = path === '/about'
      ? About()(routeContext)
      : path === '/products'
      ? Products()(routeContext)
      : Home()(routeContext);

    // Clear and re-render main content
    mainContent.innerHTML = '';
    const pageNode = pageSpec.create(pageApi);
    // NodeRef has 'element' property for element nodes
    mainContent.appendChild(pageNode.element);
  });
}

console.log('Client hydrated with routing! Navigation works without page refreshes.');
