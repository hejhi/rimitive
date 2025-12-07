/**
 * Islands App Preset - Server Version
 *
 * Provides createIslandsApp for server-side rendering.
 * Accepts signals, renderer, and view as dependencies for maximum composability.
 *
 * For client-side hydration, import from '@lattice/islands' instead.
 *
 */

import { type SignalsSvc } from '@lattice/signals/presets/core';
import { type ViewSvc } from '@lattice/view/presets/core';
import { createAddEventListener } from '@lattice/view/deps/addEventListener';
import type { RefSpec } from '@lattice/view/types';
import type { GetContext } from '../types';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { renderToString } from '../deps/renderToString';

// ============================================================================
// Types
// ============================================================================

type DomViewSvc = ViewSvc<DOMAdapterConfig>;

export type IslandsServerService = SignalsSvc &
  DomViewSvc & {
    addEventListener: ReturnType<typeof createAddEventListener>;
  };

/**
 * Server app options - accepts primitives as dependencies
 *
 * Note: Unlike the client, the server doesn't need the adapter directly
 * since there's no hybrid adapter switching. The view already incorporates
 * the adapter.
 */
export type ServerOptions<TContext> = {
  view: DomViewSvc;
  context?: GetContext<TContext>;
};

/**
 * Server app - for SSR
 */
export type ServerApp = {
  service: IslandsServerService;
  render: <TElement>(spec: RefSpec<TElement>) => {
    html: string;
    scripts: string;
  };
};

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
 *
 * @example
 * ```typescript
 * import { createIslandsApp } from '@lattice/islands/presets/core.server';
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createView } from '@lattice/view/presets/core';
 * import { createDOMServerAdapter } from '@lattice/islands/adapters/dom-server';
 *
 * const signals = createSignals();
 * const adapter = createDOMServerAdapter();
 * const view = createView({ adapter, signals })();
 *
 * const app = createIslandsApp({ view });
 * const { html, scripts } = app.render(appSpec);
 * ```
 */
export function createIslandsApp<TContext = unknown>(
  options: ServerOptions<TContext>
): ServerApp {
  const { view, context: getContext } = options;

  // Compose service from provided dependencies
  const service: IslandsServerService = {
    ...view,
    addEventListener: createAddEventListener(view.batch),
  } as IslandsServerService;

  // Create SSR context
  const ssrCtx = createSSRContext({ getContext });

  return {
    service,
    render: <TElement>(spec: RefSpec<TElement>) => {
      const element = spec.create(service);
      const html = runWithSSRContext(ssrCtx, () => renderToString(element));
      const scripts = getIslandScripts(ssrCtx);
      return { html, scripts };
    },
  };
}
