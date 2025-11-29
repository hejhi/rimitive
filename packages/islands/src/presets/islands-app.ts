/**
 * Islands App Preset - Client Version
 *
 * Provides createIslandsApp for client-side hydration and SPA.
 * For server-side rendering, import from '@lattice/islands/server' instead.
 *
 * @example
 * ```ts
 * import { createIslandsApp } from '@lattice/islands';
 *
 * const app = createIslandsApp({
 *   container: document.querySelector('.app'),
 *   context: () => buildAppContext(location.href),
 * });
 * app.mount(router.mount(routes));
 * app.hydrate(ProductFilter, Navigation);
 * ```
 */

import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  createViewApi,
} from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { composeFrom } from '@lattice/lattice';
import type { RefSpec, Renderer, NodeRef } from '@lattice/view/types';
import type { GetContext } from '../types';
import { ISLAND_META } from '../types';
import { createDOMHydrationRenderer } from '../renderers/dom-hydration';
import type { DOMRendererConfig } from '../renderers/dom-hydration';
import { createIslandsRenderer } from '../renderers/islands';
import { setClientContext } from '../client-context.browser';
import { createDOMHydrator } from '../hydrators/dom';

// ============================================================================
// Types
// ============================================================================

/**
 * Client app options
 */
export interface ClientOptions<TContext> {
  /**
   * Container element for hydration (required for client)
   */
  container: HTMLElement;

  /**
   * Context getter for islands
   * Called on init and navigation (popstate), reactive via signal
   */
  context?: GetContext<TContext>;
}

/**
 * Signals API type
 */
type SignalsApi = ReturnType<typeof createSignalsApi>;

/**
 * View API type for DOM renderer
 */
type ViewsApi = ReturnType<typeof createViewApi<DOMRendererConfig>>;

/**
 * Full service type - signals + views + addEventListener
 */
export type IslandsClientService = SignalsApi &
  ViewsApi & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Island component type for hydrate()
 * Uses unknown for metadata to allow heterogeneous island collections
 */
type IslandComponent = { [ISLAND_META]?: unknown };

/**
 * Client app - for hydration and SPA
 */
export interface ClientApp {
  /** Full service (signals + views) - use with router and components */
  service: IslandsClientService;
  /** Signals API (for advanced use cases) */
  signals: SignalsApi;
  /**
   * Mount a component spec
   * @param spec - Component spec with create() method
   * @param svc - Optional service override (useful when router adds navigate)
   */
  mount: <TElement>(
    spec: RefSpec<TElement>,
    svc?: IslandsClientService | Record<string, unknown>
  ) => NodeRef<TElement>;
  /**
   * Hydrate islands on the page
   * @param islands - Island components to hydrate
   */
  hydrate: (...islands: IslandComponent[]) => void;
  /**
   * Update context signal (call after navigation)
   */
  updateContext: () => void;
  /**
   * API factory for island hydrator (advanced use)
   */
  createApi: (
    renderer: Renderer<DOMRendererConfig>,
    signals: SignalsApi
  ) => {
    api: IslandsClientService;
    createElementScope: <TElement extends object>(
      element: TElement,
      fn: () => void
    ) => unknown;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create an islands app for client-side hydration
 *
 * For server-side rendering, import from '@lattice/islands/server':
 * ```ts
 * import { createIslandsApp } from '@lattice/islands/server';
 * ```
 */
export function createIslandsApp<TContext = unknown>(
  options: ClientOptions<TContext>
): ClientApp {
  const { container, context: getContext } = options;

  // Create signals API
  const signals = createSignalsApi();

  // Create reactive context signal if getContext is provided
  const contextSignal = getContext
    ? signals.signal<TContext | undefined>(getContext())
    : null;

  // Set up the client context getter for islands
  const contextGetter: GetContext<TContext> = contextSignal
    ? () => contextSignal()
    : () => undefined;

  setClientContext(contextGetter);

  // Listen for navigation changes (popstate for back/forward)
  if (getContext && contextSignal) {
    window.addEventListener('popstate', () => {
      contextSignal(getContext());
    });
  }

  // Create hybrid renderer: hydration mode first, then fallback to regular DOM
  const hydrationRenderer = createDOMHydrationRenderer(container);
  const fallbackRenderer = createDOMRenderer();
  const hybridRenderer = createIslandsRenderer(
    hydrationRenderer,
    fallbackRenderer
  );

  // Cast to base renderer type for createSpec
  const renderer: Renderer<DOMRendererConfig> = hybridRenderer;

  // Create view helpers
  const viewHelpers = createSpec(renderer, signals);
  const views = composeFrom(
    defaultViewExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  // Compose service with proper typing
  const service: IslandsClientService = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(signals.batch),
  } as IslandsClientService;

  // Track whether we've switched to fallback renderer
  let switched = false;

  // Mount function with auto-switch after first mount
  const mount = <TElement>(
    spec: RefSpec<TElement>,
    svc: IslandsClientService | Record<string, unknown> = service
  ): NodeRef<TElement> => {
    const result = spec.create(svc);
    if (!switched) {
      switched = true;
      hybridRenderer.switchToFallback();
    }
    return result;
  };

  // API factory for island hydrator
  const createApi = (
    islandRenderer: Renderer<DOMRendererConfig>,
    islandSignals: SignalsApi
  ) => {
    const islandViewHelpers = createSpec(islandRenderer, islandSignals);
    const islandViews = composeFrom(
      defaultViewExtensions<DOMRendererConfig>(),
      islandViewHelpers
    );
    const api: IslandsClientService = {
      ...islandSignals,
      ...islandViews,
      addEventListener: createAddEventListener(islandSignals.batch),
    } as IslandsClientService;
    return {
      api,
      createElementScope: islandViewHelpers.createElementScope,
    };
  };

  // Create hydrator
  const hydrator = createDOMHydrator(createApi, signals, (spec) => ({
    element: spec.create(service),
  }));

  // Update context (call after navigation)
  const updateContext = () => {
    if (getContext && contextSignal) {
      contextSignal(getContext());
    }
  };

  return {
    service,
    signals,
    mount,
    hydrate: hydrator.hydrate,
    updateContext,
    createApi,
  };
}

// Re-export types for convenience
export type { DOMRendererConfig } from '../renderers/dom-hydration';
export type { GetContext } from '../types';
