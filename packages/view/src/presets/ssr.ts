/**
 * SSR Preset for Lattice View
 *
 * Pre-configured API for server-side rendering.
 * Provides the same API surface as the browser preset but optimized for SSR.
 * Requires a renderer to be provided (e.g., linkedom-based renderer from @lattice/data).
 */

import { createApi } from '@lattice/lattice';
import {
  defaultExtensions,
} from './core';
import { createSpec } from '../helpers';
import type { Renderer, RendererConfig } from '../renderer';
import type { SealedSpec } from '../types';
import { create as createComponent } from '../component';
import type { ComponentFactory } from './core';

export type { ComponentFactory } from './core';

/**
 * Create an SSR-ready view API with a provided renderer
 *
 * @param signals - Signals API (from @lattice/signals/presets/core)
 * @param renderer - SSR renderer (e.g., from @lattice/data/renderers/linkedom-island)
 * @returns API object with el, map, match, and mount
 *
 * @example
 * ```ts
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createSSRApi } from '@lattice/view/presets/ssr';
 * import { createLinkedomIslandRenderer } from '@lattice/data/renderers/linkedom-island';
 *
 * const signals = createSignalsApi();
 * const renderer = createLinkedomIslandRenderer();
 * const { api, mount, create } = createSSRApi(signals, renderer);
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
export const createSSRApi = <TConfig extends RendererConfig>(
  signals: {
    signal: <T>(value: T) => () => T;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
  renderer: Renderer<TConfig>
)=> {
  const viewHelpers = createSpec(renderer, signals);
  const views = createApi(defaultExtensions<TConfig>(), viewHelpers);

  const api = {
    ...signals,
    ...views,
  };

  return {
    api,
    signals,
    views,
    renderer,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(api),
    create: createComponent as ComponentFactory<typeof api>,
  };
};

export type SSRApi = ReturnType<typeof createSSRApi>['api'];
export type SSRViews = ReturnType<typeof createSSRApi>['views'];
