/**
 * Islands App Preset - Client Version
 *
 * Provides createIslandsApp for client-side hydration and SPA.
 * Accepts signals, renderer, and view as dependencies for maximum composability.
 *
 * For server-side rendering, import from '@lattice/islands/server' instead.
 *
 */

import { type SignalsSvc } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  type ViewSvc,
} from '@lattice/view/presets/core';
import { createScopes } from '@lattice/view/helpers/scope';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { compose } from '@lattice/lattice';
import type { RefSpec, Adapter, NodeRef } from '@lattice/view/types';
import type { GetContext } from '../types';
import { ISLAND_META } from '../types';
import type { DOMAdapterConfig } from '../adapters/dom-hydration';
import { setClientContext } from '../client-context.browser';
import { createDOMHydrator } from '../hydrators/dom';

// ============================================================================
// Types
// ============================================================================

/**
 * View service type
 */
export type DomViewSvc = ViewSvc<DOMAdapterConfig>;

/**
 * Hybrid adapter type (from createIslandsAdapter)
 */
export type HybridAdapter = Adapter<DOMAdapterConfig> & {
  switchToFallback: () => void;
};

/**
 * Full service type - signals + views + addEventListener
 */
export type IslandsClientService = SignalsSvc &
  DomViewSvc & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Client app options - accepts primitives as dependencies
 */
export type ClientOptions<TContext> = {
  signals: SignalsSvc;
  adapter: HybridAdapter;
  view: DomViewSvc;
  context?: GetContext<TContext>;
};

/**
 * Island component type for hydrate()
 * Uses unknown for metadata to allow heterogeneous island collections
 */
export type IslandComponent = { [ISLAND_META]?: unknown };

/**
 * Client app - for hydration and SPA
 */
export type ClientApp = {
  service: IslandsClientService;
  signals: SignalsSvc;
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
   * Service factory for island hydrator (advanced use)
   */
  createSvc: (
    adapter: Adapter<DOMAdapterConfig>,
    signals: SignalsSvc
  ) => {
    svc: IslandsClientService;
    createElementScope: <TElement extends object>(
      element: TElement,
      fn: () => void
    ) => unknown;
  };
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create an islands app for client-side hydration
 *
 * Accepts signals, adapter, and view as dependencies - does not create them internally.
 * This allows maximum composability and custom extensions.
 *
 * For server-side rendering, import from '\@lattice/islands/server':
 * ```ts
 * import { createIslandsApp } from '@lattice/islands/server';
 * ```
 *
 * @example
 * ```typescript
 * import { createIslandsApp } from '@lattice/islands/presets/core.client';
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 * import { createViewSvc } from '@lattice/view/presets/core';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createIslandsAdapter } from '@lattice/islands/adapters/islands';
 * import { createDOMHydrationAdapter } from '@lattice/islands/adapters/dom-hydration';
 *
 * const signals = createSignalsSvc();
 * const domAdapter = createDOMAdapter();
 * const hydrateAdapter = createDOMHydrationAdapter(document.body);
 * const adapter = createIslandsAdapter(hydrateAdapter, domAdapter);
 * const view = createViewSvc(adapter, signals);
 *
 * const app = createIslandsApp({ signals, adapter, view });
 * app.hydrate(Counter, TodoList);
 * ```
 */
export function createIslandsApp<TContext = unknown>(
  options: ClientOptions<TContext>
): ClientApp {
  const { signals, adapter, view, context: getContext } = options;

  // Create reactive context signal if getContext is provided
  const contextSignal = getContext
    ? signals.signal<TContext | undefined>(getContext())
    : null;

  // Set up the client context getter for islands
  const contextGetter: GetContext<TContext> = contextSignal
    ? () => contextSignal()
    : () => undefined;

  setClientContext(contextGetter);

  // Compose service from provided dependencies
  const service: IslandsClientService = {
    ...signals,
    ...view,
    addEventListener: createAddEventListener(signals.batch),
  } as IslandsClientService;

  // Track whether we've switched to fallback adapter
  let switched = false;

  // Mount function with auto-switch after first mount
  const mount = <TElement>(
    spec: RefSpec<TElement>,
    svc: IslandsClientService | Record<string, unknown> = service
  ): NodeRef<TElement> => {
    const result = spec.create(svc);
    if (!switched) {
      switched = true;
      adapter.switchToFallback();
    }
    return result;
  };

  // Service factory for island hydrator
  const createSvc = (
    islandAdapter: Adapter<DOMAdapterConfig>,
    islandSignals: SignalsSvc
  ): {
    svc: IslandsClientService;
    createElementScope: <TElement extends object>(
      element: TElement,
      fn: () => void
    ) => unknown;
  } => {
    const scopes = createScopes({ baseEffect: islandSignals.effect });
    const islandViews = compose(defaultViewExtensions<DOMAdapterConfig>(), {
      adapter: islandAdapter,
      ...scopes,
      signal: islandSignals.signal,
      computed: islandSignals.computed,
      effect: islandSignals.effect,
      batch: islandSignals.batch,
    })();
    const svc: IslandsClientService = {
      ...islandSignals,
      ...islandViews,
      addEventListener: createAddEventListener(islandSignals.batch),
    } as IslandsClientService;
    return {
      svc,
      createElementScope: scopes.createElementScope,
    };
  };

  // Create hydrator
  const hydrator = createDOMHydrator(createSvc, signals, (spec) => ({
    element: spec.create(service),
  }));

  // Update context (call after navigation)
  const updateContext = (): void => {
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
    createSvc,
  };
}

// Re-export types for convenience
export type { DOMAdapterConfig } from '../adapters/dom-hydration';
export type { GetContext } from '../types';
export { ISLAND_META } from '../types';
