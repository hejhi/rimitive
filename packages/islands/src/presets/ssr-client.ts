/**
 * SSR Client Preset
 *
 * Simplified setup for SSR client hydration.
 * Handles:
 * - Hybrid renderer (hydration → regular DOM)
 * - Service composition (signals + views)
 * - Auto-switching after first mount
 * - API factory for island hydration
 * - Request context for islands
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
import type { RequestContext } from '../types';
import { setClientRequestContext } from '../client-context.browser';

/**
 * Options for createSSRClientApp
 */
export interface SSRClientAppOptions {
  /**
   * Container element for hydration
   * If null, falls back to regular DOM rendering
   */
  container: HTMLElement | null;
}

/**
 * Build RequestContext from current location
 */
function buildRequestContext(): RequestContext {
  const url = new URL(window.location.href);
  return {
    url,
    pathname: url.pathname,
    search: url.search,
    searchParams: url.searchParams,
  };
}

/**
 * Create a fully configured SSR client app
 *
 * Returns direct exports - no lazy init, no proxies.
 * Call this at the top level of your client entry point.
 */
export function createSSRClientApp(options: SSRClientAppOptions) {
  const { container } = options;

  // Create signals API
  const signals = createSignalsApi();

  // Create reactive request context signal
  const requestSignal = signals.signal<RequestContext>(buildRequestContext());

  // Set up the client request context for islands
  setClientRequestContext(() => requestSignal());

  // Listen for navigation changes (popstate for back/forward)
  window.addEventListener('popstate', () => {
    requestSignal(buildRequestContext());
  });

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
   * Update the request context (call after navigation)
   * This updates the reactive signal so islands re-render
   */
  const updateRequestContext = () => {
    requestSignal(buildRequestContext());
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
    /** Update request context after navigation */
    updateRequestContext,
  };
}

// Re-export types for convenience
export type { DOMRendererConfig } from '../renderers/dom-hydration';
export type { RequestContext } from '../types';
