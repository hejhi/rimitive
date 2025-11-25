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
import { createRouter, type Router } from '@lattice/router';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { RefSpec } from '@lattice/view/types';
import { type IslandClientService } from '../presets/island-client';
import { createDOMHydrator } from '../hydrators/dom';
import { createIslandsRenderer } from '../renderers/islands';
import { ISLAND_META } from '../types';

/**
 * Service factory type - matches the return type of createIslandClientApi
 * User can wrap createIslandClientApi to add extensions
 */
export type ServiceFactory<
  TService extends IslandClientService = IslandClientService,
> = (signals: ReturnType<typeof createSignalsApi>) => TService;

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
export interface HydrateAppOptions<TService extends IslandClientService> {
  /**
   * Service factory function
   * Pass createIslandClientApi directly, or wrap it to add extensions
   */
  createService: ServiceFactory<TService>;

  /**
   * Optional signals API from userland singleton
   * If provided, hydrateApp passes these signals to createService.
   * This ensures islands share the same reactive system as the router.
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
   */
  createApp?: (
    router: Router<DOMRendererConfig>,
    svc: TService['svc'] & { navigate: (path: string) => void }
  ) => RefSpec<unknown>;

  /**
   * Islands to hydrate
   * Pass island components created with the `island` function
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
 * 1. Calls the service factory to create client services
 * 2. Hydrates all registered islands
 * 3. Optionally mounts routes into a container element
 */
export function hydrateApp<TService extends IslandClientService>(
  options: HydrateAppOptions<TService>
): void {
  const {
    createService,
    signals: providedSignals,
    router: providedRouter,
    createApp,
    islands,
    routeContainer = '.main-content',
  } = options;

  // Use provided signals or create new ones
  const signals = providedSignals ?? createSignalsApi();

  // Call the service factory
  const { svc } = createService(signals);

  // Use provided router or create a new one
  const internalRouter = providedRouter
    ? null
    : createRouter(svc, {
        initialPath:
          window.location.pathname +
          window.location.search +
          window.location.hash,
      });

  // Get navigate function from provided router or internal router
  const navigate = providedRouter?.navigate ?? internalRouter!.navigate;

  // Add navigate to svc for islands that need it
  const svcWithNavigate = {
    ...svc,
    navigate,
  };

  // Create mount function that uses svc with navigate
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

  // Create hydrator
  const hydrator = createDOMHydrator(createFullAPI, signals, mount);

  // Hydrate islands
  hydrator.hydrate(...islands);

  // Mount routes if createApp is provided
  if (createApp) {
    const container = document.querySelector(routeContainer);
    if (container) {
      const routerForApp = (providedRouter ??
        internalRouter) as Router<DOMRendererConfig>;
      const App = createApp(routerForApp, svcWithNavigate);
      const routeRef = mount(App);

      // Replace SSR'd route content with reactive client version
      container.innerHTML = '';
      if (routeRef.element) {
        container.appendChild(routeRef.element as Node);
      }
    }
  }
}
