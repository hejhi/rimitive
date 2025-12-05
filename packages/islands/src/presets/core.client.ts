/**
 * Islands App Preset - Client Version
 *
 * Provides createIslandsApp for client-side hydration and SPA.
 * Accepts signals, renderer, and view as dependencies for maximum composability.
 *
 * For server-side rendering, import from '@lattice/islands/server' instead.
 *
 */

import { createSignalsSvc } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  createViewSvc,
} from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { composeFrom } from '@lattice/lattice';
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
 * Signals API type
 */
type SignalsSvc = ReturnType<typeof createSignalsSvc>;

/**
 * View API type for DOM adapter
 */
type ViewsSvc = ReturnType<typeof createViewSvc<DOMAdapterConfig, SignalsSvc>>;

/**
 * Hybrid adapter type (from createIslandsAdapter)
 */
type HybridAdapter = Adapter<DOMAdapterConfig> & {
  switchToFallback: () => void;
};

/**
 * Full service type - signals + views + addEventListener
 */
export type IslandsClientService = SignalsSvc &
  ViewsSvc & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Client app options - accepts primitives as dependencies
 */
export type ClientOptions<TContext> = {
  /**
   * Signals API instance
   * Create with: createSignalsSvc()
   */
  signals: SignalsSvc;

  /**
   * Hybrid adapter (hydration → fallback)
   * Create with: createIslandsAdapter(hydrationAdapter, fallbackAdapter)
   */
  adapter: HybridAdapter;

  /**
   * View API instance
   */
  view: ViewsSvc;

  /**
   * Context getter for islands
   * Called on init and navigation (popstate), reactive via signal
   */
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
  /** Full service (signals + views) - use with router and components */
  service: IslandsClientService;
  /** Signals API (for advanced use cases) */
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
   * API factory for island hydrator (advanced use)
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
 * For server-side rendering, import from '@lattice/islands/server':
 * ```ts
 * import { createIslandsApp } from '@lattice/islands/server';
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

  // API factory for island hydrator
  const createSvc = (
    islandAdapter: Adapter<DOMAdapterConfig>,
    islandSignals: SignalsSvc
  ) => {
    const islandViewHelpers = createSpec(islandAdapter, islandSignals);
    const islandViews = composeFrom(
      defaultViewExtensions<DOMAdapterConfig>(),
      islandViewHelpers
    );
    const svc: IslandsClientService = {
      ...islandSignals,
      ...islandViews,
      addEventListener: createAddEventListener(islandSignals.batch),
    } as IslandsClientService;
    return {
      svc,
      createElementScope: islandViewHelpers.createElementScope,
    };
  };

  // Create hydrator
  const hydrator = createDOMHydrator(createSvc, signals, (spec) => ({
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
    createSvc,
  };
}

// Re-export types for convenience
export type { DOMAdapterConfig } from '../adapters/dom-hydration';
export type { GetContext } from '../types';
export { ISLAND_META } from '../types';
