/**
 * Islands App Preset - Server Version
 *
 * Provides createIslandsApp for server-side rendering.
 * Accepts signals, renderer, and view as dependencies for maximum composability.
 *
 * For client-side hydration, import from '@lattice/islands' instead.
 *
 */

import { createSignalsApi } from '@lattice/signals/presets/core';
import { createViewApi } from '@lattice/view/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import type { RefSpec } from '@lattice/view/types';
import type { GetContext } from '../types';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import type { DOMServerAdapterConfig } from '../adapters/dom-server';
import { renderToString } from '../helpers/renderToString';

// ============================================================================
// Types
// ============================================================================

/**
 * Signals API type
 */
type SignalsApi = ReturnType<typeof createSignalsApi>;

/**
 * View API type for server adapter
 */
type ViewsApi = ReturnType<typeof createViewApi<DOMServerAdapterConfig>>;

/**
 * Full service type - signals + views + addEventListener
 */
export type IslandsServerService = SignalsApi &
  ViewsApi & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Server app options - accepts primitives as dependencies
 *
 * Note: Unlike the client, the server doesn't need the adapter directly
 * since there's no hybrid adapter switching. The view already incorporates
 * the adapter.
 */
export interface ServerOptions<TContext> {
  /**
   * Signals API instance
   * Create with: createSignalsApi()
   */
  signals: SignalsApi;

  /**
   * View API instance
   * Create with: createViewApi(adapter, signals)
   */
  view: ViewsApi;

  /**
   * Context getter for islands
   * Called once per render, passed to islands
   */
  context?: GetContext<TContext>;
}

/**
 * Server app - for SSR
 */
export interface ServerApp {
  /** Full service (signals + views) - use with router and components */
  service: IslandsServerService;
  /** Signals API */
  signals: SignalsApi;
  /**
   * Render a component spec to HTML
   * @param spec - Component spec with create() method
   * @returns HTML string and island hydration scripts
   */
  render: <TElement>(spec: RefSpec<TElement>) => {
    html: string;
    scripts: string;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create an islands app for server-side rendering
 *
 * Accepts signals, adapter, and view as dependencies - does not create them internally.
 * This allows maximum composability and custom extensions.
 *
 * For client-side hydration, import from '@lattice/islands':
 * ```ts
 * import { createIslandsApp } from '@lattice/islands';
 * ```
 */
export function createIslandsApp<TContext = unknown>(
  options: ServerOptions<TContext>
): ServerApp {
  const { signals, view, context: getContext } = options;

  // Compose service from provided dependencies
  const service: IslandsServerService = {
    ...signals,
    ...view,
    addEventListener: createAddEventListener(signals.batch),
  } as IslandsServerService;

  // Create SSR context
  const ssrCtx = createSSRContext({ getContext });

  return {
    service,
    signals,
    render: <TElement>(spec: RefSpec<TElement>) => {
      const element = spec.create(service);
      const html = runWithSSRContext(ssrCtx, () => renderToString(element));
      const scripts = getIslandScripts(ssrCtx);
      return { html, scripts };
    },
  };
}
