/**
 * Client Module
 *
 * Client-side utilities for SSR hydration.
 *
 * @example
 * ```ts
 * import {
 *   createClientAdapter,
 *   connectStream,
 * } from '@rimitive/ssr/client';
 *
 * const adapter = createClientAdapter(document.querySelector('.app')!);
 * const service = createService(adapter);
 * AppLayout(service).create(service);
 * adapter.activate();
 * connectStream(service, '__APP_STREAM__');
 * ```
 */

import type { Adapter } from '@rimitive/view/types';
import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
} from './adapter';

// =============================================================================
// Window Globals for SSR
// =============================================================================

/**
 * Window globals for SSR.
 *
 * Non-streaming SSR uses __RIMITIVE_DATA__ as a static object containing
 * loader data serialized by the server.
 *
 * Streaming SSR uses a user-defined stream key (e.g., '__APP_STREAM__')
 * via createStreamWriter() - no hardcoded globals needed.
 */
declare global {
  interface Window {
    /** Non-streaming SSR: static data object from server */
    __RIMITIVE_DATA__?: Record<string, unknown>;
  }
}

// =============================================================================
// Client Adapter
// =============================================================================

/** Client adapter with activate() method for switching from hydration to normal mode */
export type ClientAdapter = ReturnType<typeof createHydrationAdapter> & {
  /** Switch from hydration mode to normal DOM mode */
  activate: () => void;
};

/** Options for createClientAdapter */
export type ClientAdapterOptions = {
  /** Custom adapter for walking SSR DOM during hydration */
  hydration?: Adapter<DOMTreeConfig>;
  /** Custom adapter for post-hydration client rendering */
  client?: Adapter<DOMTreeConfig>;
};

/**
 * Create a client adapter for hydration.
 *
 * This creates the full adapter stack needed for hydrating SSR content:
 * 1. DOM hydration adapter that walks existing SSR DOM
 * 2. Regular DOM adapter for post-hydration rendering
 * 3. Async support for load() boundaries
 *
 * After hydration, call adapter.activate() to switch to normal DOM mode.
 *
 * @param root - The root element containing SSR content
 * @param options - Optional custom adapters
 * @returns Hydration adapter with activate() method
 *
 * @example
 * ```ts
 * const adapter = createClientAdapter(document.querySelector('.app')!);
 * const service = createService(adapter);
 *
 * // Hydrate
 * AppLayout(service).create(service);
 *
 * // Switch to normal client mode
 * adapter.activate();
 * ```
 */
export function createClientAdapter(
  root: HTMLElement,
  options?: ClientAdapterOptions
): ClientAdapter {
  const clientAdapter = options?.client ?? withAsyncSupport(createDOMAdapter());
  const hydrationAdapter =
    options?.hydration ?? createDOMHydrationAdapter(root);
  const adapter = createHydrationAdapter(hydrationAdapter, clientAdapter);

  return {
    ...adapter,
    activate: adapter.switchToFallback,
  };
}

// =============================================================================
// Streaming
// =============================================================================

export { connectStream } from './stream';
export type { StreamReceiver } from './stream';

// =============================================================================
// Adapters (Advanced)
// =============================================================================

export {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  withAsyncSupport,
  HydrationMismatch,
} from './adapter';

// Async fragment utilities (client-side)
export {
  triggerAsyncFragment,
  collectAsyncFragments,
  isAsyncFragment,
  ASYNC_FRAGMENT,
} from '../shared/async-fragments';
export type { AsyncFragment } from '../shared/async-fragments';
