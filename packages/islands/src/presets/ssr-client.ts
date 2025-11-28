/**
 * SSR Client Preset
 *
 * Simplified setup for SSR client hydration.
 * Handles:
 * - Hybrid renderer (hydration → regular DOM)
 * - Service composition (signals + views)
 * - Auto-switching after first mount
 * - API factory for island hydration
 * - User-defined context for islands
 *
 * Router integration is left to the app layer.
 *
 * @example
 * ```ts
 * import { createSSRClientApp } from '@lattice/islands/presets/ssr-client';
 * import { createRouter } from '@lattice/router';
 *
 * const { service, mount, createApi, signals } = createSSRClientApp({
 *   container: document.querySelector('.app'),
 *   // Optional: provide context getter for islands
 *   getContext: () => ({
 *     pathname: location.pathname,
 *     user: getCurrentUser(),
 *   }),
 * });
 *
 * // Add router at app layer
 * const router = createRouter(service, { initialPath: location.pathname });
 * const fullService = { ...service, navigate: router.navigate };
 * ```
 */

import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createDOMHydrationRenderer } from '../renderers/dom-hydration';
import type { DOMRendererConfig } from '../renderers/dom-hydration';
import { createIslandsRenderer } from '../renderers/islands';
import { composeFrom } from '@lattice/lattice';
import type { RefSpec, Renderer } from '@lattice/view/types';
import type { GetContext } from '../types';
import { setClientContext } from '../client-context.browser';

/**
 * Options for createSSRClientApp
 */
export interface SSRClientAppOptions<TContext = unknown> {
  /**
   * Container element for hydration
   * If null, falls back to regular DOM rendering
   */
  container: HTMLElement | null;

  /**
   * Context getter for islands
   *
   * Called on init and on navigation (popstate) to get the current context.
   * If not provided, islands will receive undefined from getContext().
   *
   * @example
   * ```ts
   * getContext: () => ({
   *   pathname: location.pathname,
   *   search: location.search,
   *   user: getCurrentUser(),
   * })
   * ```
   */
  getContext?: GetContext<TContext>;
}

/**
 * Create a fully configured SSR client app
 *
 * Returns direct exports - no lazy init, no proxies.
 * Call this at the top level of your client entry point.
 */
export function createSSRClientApp<TContext = unknown>(
  options: SSRClientAppOptions<TContext>
) {
  const { container, getContext } = options;

  // Create signals API
  const signals = createSignalsApi();

  // Create reactive context signal if getContext is provided
  // Otherwise context is undefined
  const contextSignal = getContext
    ? signals.signal<TContext | undefined>(getContext())
    : null;

  // Set up the client context getter for islands
  // If no getContext provided, islands get undefined
  const contextGetter: GetContext<TContext> = contextSignal
    ? () => contextSignal()
    : () => undefined;

  setClientContext(contextGetter);

  // Listen for navigation changes (popstate for back/forward)
  // Only update if we have a context getter
  if (getContext && contextSignal) {
    window.addEventListener('popstate', () => {
      contextSignal(getContext());
    });
  }

  // Create hybrid renderer: hydration mode first, then fallback to regular DOM
  const hydrationRenderer = container
    ? createDOMHydrationRenderer(container)
    : createDOMRenderer();
  const fallbackRenderer = createDOMRenderer();
  const hybridRenderer = createIslandsRenderer(
    hydrationRenderer,
    fallbackRenderer
  );

  // Cast to base renderer type for createSpec (switchToFallback is still accessible)
  const renderer: Renderer<DOMRendererConfig> = hybridRenderer;

  // Create view API
  const viewHelpers = createSpec(renderer, signals);
  const views = composeFrom(
    defaultViewExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  // Compose full service (explicitly typed for router compatibility)
  const service = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(signals.batch),
  };

  // Mount function with auto-switch after first mount
  // Accepts optional service override (useful when router adds navigate/currentPath)
  let switched = false;
  const mount = <TElement>(spec: RefSpec<TElement>, svc = service) => {
    const result = spec.create(svc);
    if (!switched) {
      switched = true;
      hybridRenderer.switchToFallback();
    }
    return result;
  };

  /**
   * API factory for island hydrator
   *
   * Creates a fresh API instance for each island using the provided renderer.
   * Returns both the API and createElementScope for proper cleanup.
   */
  const createApi = (
    islandRenderer: Renderer<DOMRendererConfig>,
    islandSignals: ReturnType<typeof createSignalsApi>
  ) => {
    const islandViewHelpers = createSpec(islandRenderer, islandSignals);
    const islandViews = composeFrom(
      defaultViewExtensions<DOMRendererConfig>(),
      islandViewHelpers
    );
    return {
      api: {
        ...islandSignals,
        ...islandViews,
      },
      createElementScope: islandViewHelpers.createElementScope,
    };
  };

  /**
   * Update the context (call after navigation)
   *
   * Calls getContext() and updates the reactive signal so islands re-render.
   * No-op if getContext was not provided in options.
   */
  const updateContext = () => {
    if (getContext && contextSignal) {
      contextSignal(getContext());
    }
  };

  return {
    /** Full service (signals + views) */
    service,
    /** Signals API (for hydrator) */
    signals,
    /** Mount function (auto-switches renderer after first mount) */
    mount,
    /** API factory for island hydrator */
    createApi,
    /** Update context after navigation */
    updateContext,
  };
}

// Re-export types for convenience
export type { DOMRendererConfig } from '../renderers/dom-hydration';
export type { GetContext } from '../types';
