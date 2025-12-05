/**
 * Islands Server Preset
 *
 * Pre-configured bundle for server-side rendering with islands.
 * Combines signals, view primitives, and SSR-specific helpers.
 *
 * @example
 * ```ts
 * import { createIslandsServerApp } from '@lattice/islands/presets/islands.server';
 *
 * const { el, signal, render } = createIslandsServerApp();
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
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import type { RefSpec } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMServerAdapter } from '../adapters/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { renderToString } from '../helpers/renderToString';
import type { GetContext } from '../types';

export type IslandsServerOptions<TContext = unknown> = {
  context?: GetContext<TContext>;
};

type SignalsSvc = ReturnType<typeof createSignalsSvc>;

const createViewSvc = (
  helpers: ReturnType<typeof defaultHelpers<DOMAdapterConfig, SignalsSvc>>
) => composeFrom(defaultExtensions<DOMAdapterConfig>(), helpers);

/**
 * Create a fully-configured islands server app
 *
 * Batteries-included preset that creates signals, view, and SSR rendering.
 */
export const createIslandsServerApp = <TContext = unknown>(
  options: IslandsServerOptions<TContext> = {}
) => {
  const signalsSvc = createSignalsSvc();
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

export type IslandsServerApp = ReturnType<typeof createIslandsServerApp>;

/**
 * Island Svc type - the service type available to island components
 * Use this with createIsland<IslandSvc>() for typed islands
 */
export type IslandSvc = ReturnType<typeof createSignalsSvc> &
  ReturnType<typeof createViewSvc>;
