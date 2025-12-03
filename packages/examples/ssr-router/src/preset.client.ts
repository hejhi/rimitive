/**
 * Client DOM Preset
 *
 * Pre-configured factory for client-side hydration with routing.
 * Creates all primitives once at startup and wires them together.
 */
import { createIslandsApp } from '@lattice/islands';
import {
  createDOMHydrationAdapter,
  createIslandsAdapter,
} from '@lattice/islands/client';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createViewApi } from '@lattice/view/presets/core';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createRouter, type ViewApi, type RouteTree } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

/**
 * Options for creating a client app
 */
export interface ClientAppOptions<TContext> {
  /** Container element to hydrate */
  container: HTMLElement;
  /** Context builder from current location */
  buildContext: () => TContext;
  /** Route tree to mount */
  routes: RouteTree<DOMAdapterConfig>;
}

/**
 * Create a client app with hydration and routing
 *
 * Returns the service, hydrate function, and router.
 * Call this once at app startup.
 */
export function createClientApp<TContext>(options: ClientAppOptions<TContext>) {
  const { container, buildContext, routes } = options;

  // Create primitives
  const signals = createSignalsApi();
  const adapter = createIslandsAdapter(
    createDOMHydrationAdapter(container),
    createDOMAdapter()
  );
  const view = createViewApi<DOMAdapterConfig>(adapter, signals);

  // Wire for islands
  const app = createIslandsApp<TContext>({
    signals,
    adapter,
    view,
    context: buildContext,
  });

  // Add router
  const router = createRouter<DOMAdapterConfig>(
    app.service as ViewApi<DOMAdapterConfig>,
    { initialPath: location.pathname + location.search + location.hash }
  );

  // Wrap navigate to also update context
  const navigate = (path: string) => {
    router.navigate(path);
    app.updateContext();
  };

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    app.updateContext();
  });

  // Build full service
  const service = {
    ...app.service,
    navigate,
    currentPath: router.currentPath,
  };

  // Mount and hydrate
  const mount = () => app.mount(router.mount(routes), service);

  return {
    service,
    mount,
    hydrate: app.hydrate,
    router,
    navigate,
  };
}

/**
 * Client service type - derived from the factory
 */
export type ClientService = ReturnType<typeof createClientApp>['service'];
