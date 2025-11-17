/**
 * SSR Preset for Lattice View
 *
 * Pre-configured API for server-side rendering with linkedom.
 * Provides the same API surface as the browser preset but optimized for SSR.
 */

import { createApi } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
} from './core';
import { createSpec } from '../helpers';
import { createLinkedomRenderer, LinkedomRendererConfig } from '../renderers/linkedom';
import type { SealedSpec } from '../types';
import { create as createComponent } from '../component';
import type { ComponentFactory } from './core';

export type { LinkedomRendererConfig } from '../renderers/linkedom';
export type { ComponentFactory } from './core';

/**
 * Create an SSR-ready view API with linkedom renderer
 *
 * @param signals - Signals API (from @lattice/signals/presets/core)
 * @returns API object with el, map, match, and mount
 *
 * @example
 * ```ts
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createSSRApi } from '@lattice/view/presets/ssr';
 *
 * const signals = createSignalsApi();
 * const { api, mount, create } = createSSRApi(signals);
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
export const createSSRApi = (signals: {
  signal: <T>(value: T) => () => T;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
}) => {
  const renderer = createLinkedomRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const views = createApi(defaultViewExtensions<LinkedomRendererConfig>(), viewHelpers);

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
