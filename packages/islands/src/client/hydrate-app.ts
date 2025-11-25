/**
 * Client-Side Hydration
 *
 * Handles island hydration and optional route mounting for client-side interactivity.
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter, type Router } from '@lattice/router';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import type { RefSpec } from '@lattice/view/types';
import { createDOMHydrator } from '../hydrators/dom';
import { createIslandsRenderer } from '../renderers/islands';
import type { ServiceDescriptor } from '../service/types';
import { ISLAND_META } from '../types';

/**
 * Full service with router navigate
 */
export type FullService<TService> = TService & {
  addEventListener: ReturnType<typeof createAddEventListener>;
  navigate: (path: string) => void;
};

/**
 * Router-like object with navigate function
 * Kept minimal to avoid coupling islands to router internals
 */
export interface RouterLike {
  navigate: (path: string) => void;
}

/**
 * Options for hydrateApp
 */
export interface HydrateAppOptions<TService> {
  /**
   * Service descriptor from defineService()
   */
  service: ServiceDescriptor<TService>;

  /**
   * Optional signals API from userland singleton
   * If provided, hydrateApp uses these signals instead of creating new ones.
   * This ensures islands share the same reactive system as the router.
   *
   * IMPORTANT: When using a router from a service singleton (like service-client.js),
   * you must pass the singleton's signals here to ensure reactivity works correctly.
   */
  signals?: ReturnType<typeof createSignalsApi>;

  /**
   * Optional router instance from userland
   * If provided, hydrateApp uses this router's navigate function instead of creating its own.
   * This ensures islands and routes share the same router state.
   */
  router?: RouterLike;

  /**
   * Function that creates the app given router and service
   * If provided, mounts routes after hydration
   *
   * Receives both router (for routing APIs) and svc (for el, signal, etc.)
   */
  createApp?: (
    router: Router<DOMRendererConfig>,
    svc: FullService<TService>
  ) => RefSpec<unknown>;

  /**
   * Islands to hydrate
   * Pass island components created with the `island` function from createIsland
   * Uses a permissive type to allow islands with different prop types
   */
  islands: Array<{ [ISLAND_META]?: unknown }>;

  /**
   * Selector for the container to mount routes into
   * Only used if createApp is provided
   * @default '.main-content'
   */
  routeContainer?: string;
}

/**
 * Hydrate islands and optionally mount routes
 *
 * This is the main entry point for client-side initialization:
 * 1. Creates client services using the service descriptor
 * 2. Hydrates all registered islands
 * 3. Optionally mounts routes into a container element
 */
export function hydrateApp<TService>(
  options: HydrateAppOptions<TService>
): void {
  const {
    service,
    signals: providedSignals,
    router: providedRouter,
    createApp,
    islands,
    routeContainer = '.main-content',
  } = options;

  // Use provided signals or create new ones
  // IMPORTANT: When using a router from a singleton, pass the singleton's signals
  // to ensure islands and router share the same reactive system
  const signals = providedSignals ?? createSignalsApi();

  // Create client base service using the signals
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);
  const views = composeFrom(
    defaultViewExtensions<DOMRendererConfig>(),
    viewHelpers
  );
  const base = { ...signals, ...views };

  // Apply user's extensions
  const svc = service.extend(base);

  // Add addEventListener helper
  const fullSvc = {
    ...svc,
    addEventListener: createAddEventListener(signals.batch),
  };

  // Use provided router or create a new one
  // If a router is provided from userland, use its navigate to ensure
  // islands and routes share the same router state
  const internalRouter = providedRouter
    ? null
    : (createRouter(fullSvc as unknown as Parameters<typeof createRouter>[0], {
        initialPath:
          window.location.pathname +
          window.location.search +
          window.location.hash,
      }) as unknown as Router<DOMRendererConfig>);

  // Get navigate function from provided router or internal router
  const navigate = providedRouter?.navigate ?? internalRouter!.navigate;

  // Add navigate to svc for islands that need it
  const svcWithNavigate = {
    ...fullSvc,
    navigate,
  };

  // Create mount function
  const mount = <TElement>(spec: RefSpec<TElement>) =>
    spec.create(svcWithNavigate);

  // Create API factory for hydrator
  function createFullAPI(
    renderer: ReturnType<typeof createIslandsRenderer>,
    signalsApi: ReturnType<typeof createSignalsApi>
  ) {
    const helpers = defaultViewHelpers<DOMRendererConfig>(renderer, signalsApi);
    const views = composeFrom(
      defaultViewExtensions<DOMRendererConfig>(),
      helpers
    );

    return {
      ...signalsApi,
      ...views,
      navigate,
    };
  }

  // Create hydrator (pass signals, not combined base)
  const hydrator = createDOMHydrator(createFullAPI, signals, mount);

  // Hydrate islands
  hydrator.hydrate(...islands);

  // Mount routes if createApp is provided
  if (createApp) {
    const container = document.querySelector(routeContainer);
    if (container) {
      // Use provided router if available, otherwise use internal router
      // Note: if no router is provided but createApp is used, we need the internal router
      const routerForApp = (providedRouter ??
        internalRouter) as Router<DOMRendererConfig>;
      const App = createApp(
        routerForApp,
        svcWithNavigate as FullService<TService>
      );
      const routeRef = mount(App);

      // Replace SSR'd route content with reactive client version
      container.innerHTML = '';
      if (routeRef.element) {
        container.appendChild(routeRef.element as Node);
      }
    }
  }
}
