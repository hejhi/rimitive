/**
 * Hydrate - Client-side hydration for edge SSR
 *
 * Utilities for hydrating server-rendered HTML on the client.
 * Copy this file into your project and modify as needed.
 */

import { createClientAdapter, connectStream } from '@rimitive/ssr/client';
import type { RefSpec } from '@rimitive/view/types';
import type { Loader } from '@rimitive/view/load';

/** Service with a loader (required for streaming) */
type HasLoader = { loader: Loader };

export type HydrateOptions<TService> = {
  /** CSS selector for the root element (must match what your App component creates) */
  rootSelector: string;
  /** Create the service with the hydration adapter */
  createService: (
    adapter: ReturnType<typeof createClientAdapter>,
    options: { initialPath: string }
  ) => TService;
  /** Create the app spec from service */
  createApp: (service: TService) => () => RefSpec<unknown>;
  /** Stream key for streaming SSR (must match server). Requires service to have a loader. */
  streamKey?: string;
};

export type HydrateResult<TService> = {
  /** The hydrated service */
  service: TService;
  /** The client adapter (for manual control if needed) */
  adapter: ReturnType<typeof createClientAdapter>;
};

/**
 * Hydrate a server-rendered app.
 *
 * This function:
 * 1. Finds the root element matching your App's output
 * 2. Creates a hydration adapter that walks the existing DOM
 * 3. Runs your App component to wire up reactivity
 * 4. Switches to normal DOM mode
 * 5. Connects to the streaming receiver (if streamKey provided)
 *
 * @example
 * ```ts
 * const { service } = hydrateApp({
 *   rootSelector: '.container',
 *   streamKey: '__APP_STREAM__',
 *   createService: (adapter, opts) => createService(adapter, opts),
 *   createApp: (svc) => App(svc),
 * });
 * ```
 *
 * @important The rootSelector must match the element your root component creates.
 * If App creates `el('div').props({ class: 'container' })`, use `.container`.
 */
export function hydrateApp<TService>(
  options: HydrateOptions<TService>
): HydrateResult<TService> {
  const { rootSelector, createService, createApp, streamKey } = options;

  // Find the root element
  const root = document.querySelector<HTMLElement>(rootSelector);
  if (!root) {
    throw new Error(
      `Hydration root not found: "${rootSelector}". ` +
        `Make sure this selector matches the element your App component creates.`
    );
  }

  // Create hydration adapter
  const adapter = createClientAdapter(root);

  // Create service with hydration adapter
  const svc = createService(adapter, {
    initialPath: window.location.pathname,
  });

  // Run the app to hydrate
  const app = createApp(svc);
  app().create(svc);

  // Switch to normal DOM mode
  adapter.activate();

  // Connect to streaming receiver if streaming
  if (streamKey) {
    connectStream(svc as HasLoader, streamKey);
  }

  console.log('[hydrate] Complete');

  return { service: svc, adapter };
}

/**
 * Check if the app needs hydration.
 *
 * Returns true if:
 * - The root element exists
 * - It has server-rendered content
 *
 * Use this to decide between hydration and full client-side render.
 *
 * @example
 * ```ts
 * if (needsHydration('.container')) {
 *   hydrateApp({ ... });
 * } else {
 *   renderApp({ ... });
 * }
 * ```
 */
export function needsHydration(rootSelector: string): boolean {
  const root = document.querySelector(rootSelector);
  return root !== null && root.children.length > 0;
}
