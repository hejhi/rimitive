/**
 * Islands Server Preset
 *
 * Pre-configured bundle for server-side rendering with islands.
 * Combines signals, view primitives, and SSR-specific deps.
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

import { type SignalsSvc } from '@lattice/signals/presets/core';
import { createViewSvc, ViewSvc } from '@lattice/view/presets/core';
import type { RefSpec } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMServerAdapter } from '../adapters/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { renderToString } from '../deps/renderToString';
import type { GetContext } from '../types';

export type IslandsServerOptions<TContext = unknown> = {
  context?: GetContext<TContext>;
};

type DomViewSvc = ViewSvc<DOMAdapterConfig>;

/**
 * Islands server app type
 */
export type IslandsServerApp = SignalsSvc &
  DomViewSvc & {
    mount: <TElement>(
      spec: RefSpec<TElement>
    ) => ReturnType<RefSpec<TElement>['create']>;
    render: <TElement>(spec: RefSpec<TElement>) => {
      html: string;
      scripts: string;
    };
  };

/**
 * Create a fully-configured islands server app
 *
 * Batteries-included preset that creates signals, view, and SSR rendering.
 *
 * @example
 * ```typescript
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
export function createIslandsServerApp<TContext = unknown>(
  options: IslandsServerOptions<TContext> = {}
): IslandsServerApp {
  const adapter = createDOMServerAdapter();
  const svc = createViewSvc(adapter)();
  const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

  const render = <TElement>(
    spec: RefSpec<TElement>
  ): { html: string; scripts: string } => {
    const ctx = createSSRContext({ getContext: options.context });
    const html = runWithSSRContext(ctx, () => renderToString(mount(spec)));
    const scripts = getIslandScripts(ctx);
    return { html, scripts };
  };

  return { ...svc, mount, render };
}

/**
 * Island Svc type - the service type available to island components
 * Use this with createIsland<IslandSvc>() for typed islands
 */
export type IslandSvc = SignalsSvc & DomViewSvc;
