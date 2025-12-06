/**
 * SSR DOM Preset
 *
 * Pre-configured factory for SSR with routing.
 * Creates all primitives per-request and wires them together.
 *
 * The Service type is derived from this factory's return type,
 * so types stay in sync automatically.
 */
import {
  createIslandsApp,
  createDOMServerAdapter,
} from '@lattice/islands/server';
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createViewSvc } from '@lattice/view/presets/core';
import { createRouter, type ViewSvc, type RouteTree } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

/**
 * Options for creating an SSR app
 */
export type SSRAppOptions<TContext> = {
  /** Request URL */
  url: URL;
  /** Context builder from URL */
  buildContext: (url: URL) => TContext;
  /** Route tree to mount */
  routes: RouteTree<DOMAdapterConfig>;
};

/**
 * Create an SSR app with routing
 *
 * Returns the service, render function, and router.
 * Call this per-request with the request URL.
 */
export function createSSRApp<TContext>(options: SSRAppOptions<TContext>) {
  const { url, buildContext, routes } = options;
  const path = url.pathname;

  // Create primitives
  const signals = createSignalsSvc()();
  const adapter = createDOMServerAdapter();
  const view = createViewSvc<DOMAdapterConfig, typeof signals>(
    adapter,
    signals
  )();

  // Wire for islands
  const app = createIslandsApp({
    signals,
    view,
    context: () => buildContext(url),
  });

  // Add router
  const router = createRouter<DOMAdapterConfig>(
    app.service as ViewSvc<DOMAdapterConfig>,
    { initialPath: path }
  );

  // Build full service
  const service = {
    ...app.service,
    navigate: router.navigate,
    currentPath: router.currentPath,
  };

  // Render function
  const render = () => app.render(router.mount(routes));

  return {
    service,
    render,
    router,
  };
}

/**
 * Service type - derived from the factory
 */
export type SSRService = ReturnType<typeof createSSRApp>['service'];
