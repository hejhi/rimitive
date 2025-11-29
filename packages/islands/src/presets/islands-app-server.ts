/**
 * Islands App Preset - Server Version
 *
 * Provides createIslandsApp for server-side rendering.
 * For client-side hydration, import from '@lattice/islands' instead.
 *
 * @example
 * ```ts
 * import { createIslandsApp } from '@lattice/islands/server';
 *
 * const app = createIslandsApp({ context: () => buildAppContext(url) });
 * const { html, scripts } = app.render(router.mount(routes));
 * ```
 */

import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  createViewApi,
} from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { composeFrom } from '@lattice/lattice';
import type { RefSpec } from '@lattice/view/types';
import type { GetContext } from '../types';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { createDOMServerRenderer } from '../renderers/dom-server';
import type { DOMServerRendererConfig } from '../renderers/dom-server';
import { renderToString } from '../helpers/renderToString';

// ============================================================================
// Types
// ============================================================================

/**
 * Signals API type
 */
type SignalsApi = ReturnType<typeof createSignalsApi>;

/**
 * View API type for server renderer
 */
type ViewsApi = ReturnType<typeof createViewApi<DOMServerRendererConfig>>;

/**
 * Full service type - signals + views + addEventListener
 */
export type IslandsServerService = SignalsApi &
  ViewsApi & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Server app options
 */
export interface ServerOptions<TContext> {
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
  render: <TElement>(spec: RefSpec<TElement>) => { html: string; scripts: string };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create an islands app for server-side rendering
 *
 * For client-side hydration, import from '@lattice/islands':
 * ```ts
 * import { createIslandsApp } from '@lattice/islands';
 * ```
 */
export function createIslandsApp<TContext = unknown>(
  options: ServerOptions<TContext> = {}
): ServerApp {
  const { context: getContext } = options;

  // Create signals API
  const signals = createSignalsApi();

  // Create server renderer
  const renderer = createDOMServerRenderer();

  // Create view helpers
  const viewHelpers = createSpec(renderer, signals);
  const views = composeFrom(
    defaultViewExtensions<DOMServerRendererConfig>(),
    viewHelpers
  );

  // Compose service with proper typing
  const service: IslandsServerService = {
    ...signals,
    ...views,
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
