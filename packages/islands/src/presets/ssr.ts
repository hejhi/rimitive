/**
 * SSR Preset
 *
 * Pre-configured bundle for server-side rendering with islands.
 * Combines signals, view primitives, and SSR-specific helpers.
 *
 * @example
 * ```ts
 * import { createSSRSvc } from '@lattice/islands/presets/ssr';
 *
 * const { el, signal, render } = createSSRSvc();
 *
 * const App = () => el('div')(
 *   el('h1')('Hello SSR'),
 *   Counter({ initialCount: 0 })
 * );
 *
 * const { html, scripts } = render(App());
 * ```
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import type { RefSpec } from '@lattice/view/types';
import {
  createDOMServerAdapter,
  type DOMServerAdapterConfig,
} from '../adapters/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { renderToString } from '../helpers/renderToString';
import type { GetContext } from '../types';

export type { DOMServerAdapterConfig } from '../adapters/dom-server';

export interface SSRSvcOptions<TContext = unknown> {
  context?: GetContext<TContext>;
}

const createViewSvc = (
  helpers: ReturnType<typeof defaultHelpers<DOMServerAdapterConfig>>
) => composeFrom(defaultExtensions<DOMServerAdapterConfig>(), helpers);

/**
 * Create a fully-configured SSR service
 */
export const createSSRSvc = <TContext = unknown>(
  options: SSRSvcOptions<TContext> = {}
) => {
  const signalsSvc = createSignalsApi();
  const adapter = createDOMServerAdapter();
  const viewHelpers = defaultHelpers(adapter, signalsSvc);
  const viewSvc = createViewSvc(viewHelpers);

  const svc = { ...signalsSvc, ...viewSvc };

  const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

  const render = <TElement>(spec: RefSpec<TElement>) => {
    const ctx = createSSRContext({ getContext: options.context });
    const html = runWithSSRContext(ctx, () => renderToString(mount(spec)));
    const scripts = getIslandScripts(ctx);
    return { html, scripts };
  };

  return { ...svc, mount, render };
};

export type SSRSvc = ReturnType<typeof createSSRSvc>;

/**
 * Island API type - the service interface available to island components
 * Use this with createIsland<IslandAPI>() for typed islands
 */
export type IslandAPI = ReturnType<typeof createSignalsApi> &
  ReturnType<typeof createViewSvc>;
