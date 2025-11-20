/**
 * Island-aware SSR Preset
 *
 * Pre-configured API for server-side rendering with island support.
 * Uses the island-aware linkedom renderer that automatically decorates
 * island fragments with hydration markers.
 */

import { createApi } from '@lattice/lattice';
import { defaultExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '../renderers/dom-server';
import type { RefSpec } from '@lattice/view/types';
import { ReactiveAdapter } from '../../../view/dist/src/reactive-adapter';

/**
 * Create an island-aware SSR API
 *
 * Pre-configured API for server-side rendering with island support.
 * Provides the same API surface as the browser preset but optimized for SSR.
 *
 * @param signals - Signals API (from @lattice/signals/presets/core)
 * @returns API object with el, map, match, mount, and island renderer
 *
 * @example
 * ```ts
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createIslandSSRApi } from '@lattice/islands/presets/island-ssr';
 *
 * const signals = createSignalsApi();
 * const { api, mount, create } = createIslandSSRApi(signals);
 *
 * const App = create(({ el }) => () => {
 *   return el('div', { className: 'app' })(
 *     el('h1')('Hello SSR!')
 *   )();
 * });
 *
 * const rendered = mount(App());
 * const html = rendered.element.outerHTML;
 * ```
 */
export const createIslandSSRApi = <T extends ReactiveAdapter>(signals: T) => {
  const renderer = createDOMServerRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const views = createApi(defaultExtensions<DOMServerRendererConfig>(), viewHelpers);

  const api = {
    ...signals,
    ...views,
  };

  type ApiType = typeof api;

  return {
    api,
    signals,
    views,
    renderer,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(api),
    create: <TReturn>(fn: (api: ApiType) => TReturn): TReturn => fn(api),
  };
};

export type IslandSSRApi = ReturnType<typeof createIslandSSRApi>['api'];
export type IslandSSRViews = ReturnType<typeof createIslandSSRApi>['views'];
