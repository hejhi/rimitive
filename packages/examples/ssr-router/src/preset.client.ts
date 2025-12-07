/**
 * Client DOM Preset
 *
 * Pre-configured factory for client-side hydration with routing.
 * Creates all primitives once at startup and wires them together.
 */
import {
  createIslandsApp,
  createDOMHydrationAdapter,
  createIslandsAdapter,
} from '@lattice/islands/client';
import { createView } from '@lattice/view/presets/core';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createRouter, type ViewSvc, type RouteTree } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createSignals } from '@lattice/signals';

/**
 * Options for creating a client app
 */
export type ClientAppOptions<TContext> = {
  /** Container element to hydrate */
  container: HTMLElement;
  /** Context builder from current location */
  buildContext: () => TContext;
  /** Route tree to mount */
  routes: RouteTree<DOMAdapterConfig>;
};

/**
 * Create a client app with hydration and routing
 *
 * Returns the service, hydrate function, and router.
 * Call this once at app startup.
 */
export function createClientApp<TContext>(options: ClientAppOptions<TContext>) {
  const { container, buildContext, routes } = options;

  // Create primitives
  const adapter = createIslandsAdapter(
    createDOMHydrationAdapter(container),
    createDOMAdapter()
  );
  const signals = createSignals();
  const view = createView<DOMAdapterConfig>({ adapter, signals })();

  // Wire for islands
  const app = createIslandsApp<TContext>({
    adapter,
    view,
    context: buildContext,
  });

  // Add router
  const router = createRouter<DOMAdapterConfig>(
    app.service as ViewSvc<DOMAdapterConfig>,
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
 * Client app type - inferred from factory return
 */
export type ClientAppResult = ReturnType<typeof createClientApp>;

/**
 * Client service type - derived from the factory
 */
export type ClientService = ClientAppResult['service'];
