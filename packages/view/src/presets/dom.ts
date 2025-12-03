/**
 * DOM App Preset
 *
 * Pre-configured bundle for building DOM-based apps.
 * Combines signals, view primitives, and DOM-specific helpers.
 *
 * @example
 * ```ts
 * import { createDOMSvc } from '@lattice/view/presets/dom';
 *
 * const { el, signal, computed, on, t, mount } = createDOMSvc();
 *
 * const App = () => {
 *   const count = signal(0);
 *   return el('div')(
 *     t`Count: ${count}`,
 *     el('button').ref(on('click', () => count(c => c + 1)))('+')
 *   );
 * };
 *
 * document.body.appendChild(mount(App()));
 * ```
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '../adapters/dom';
import { createAddEventListener } from '../helpers/addEventListener';
import { createText } from '../helpers/text';
import { defaultExtensions, defaultHelpers } from './core';
import type { RefSpec, ReactiveAdapter } from '../types';

export type { DOMAdapterConfig } from '../adapters/dom';

/**
 * Create DOM view service (view primitives only, no signals)
 *
 * Use this when you need to share signals between multiple adapters
 * (e.g., DOM + Canvas in the same app).
 *
 * @example
 * ```ts
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createDOMViewSvc } from '@lattice/view/presets/dom';
 *
 * const signals = createSignalsApi();
 * const dom = createDOMViewSvc(signals);
 * const canvas = createCanvasViewSvc(signals);
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createDOMViewSvc = (signals: ReactiveAdapter) => {
  const adapter = createDOMAdapter();
  const viewHelpers = defaultHelpers(adapter, signals);
  const viewSvc = composeFrom(defaultExtensions<DOMAdapterConfig>(), viewHelpers);

  const svc = {
    ...viewSvc,
    on: createAddEventListener(viewHelpers.batch),
    t: createText(signals.computed),
  };

  return {
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

/**
 * Create a fully-configured DOM app service
 *
 * Returns a flat API with all signals and view primitives,
 * plus DOM-specific helpers (on, t) and a mount function.
 *
 * @example
 * ```ts
 * // Simple usage - destructure what you need
 * const { el, signal, on, mount } = createDOMSvc();
 *
 * // Or export everything for component files
 * export const { signal, computed, effect, batch, el, map, match, on, t, mount } = createDOMSvc();
 * ```
 */
export const createDOMSvc = () => {
  const signals = createSignalsApi();
  const dom = createDOMViewSvc(signals);

  return {
    ...signals,
    ...dom,
  };
};

/**
 * Type of the service returned by createDOMSvc
 */
export type DOMSvc = ReturnType<typeof createDOMSvc>;
export type DOMViewSvc = ReturnType<typeof createDOMViewSvc>;
export type DOMSignals = ReturnType<typeof createSignalsApi>;
