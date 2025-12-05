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
 * const { el, signal, computed, on, mount } = createDOMSvc();
 *
 * const App = () => {
 *   const count = signal(0);
 *   return el('div')(
 *     el('p').props({ textContent: computed(() => `Count: ${count()}`) }),
 *     el('button').ref(on('click', () => count(c => c + 1)))('+')
 *   );
 * };
 *
 * document.body.appendChild(mount(App()));
 * ```
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '../adapters/dom';
import { createAddEventListener } from '../helpers/addEventListener';
import { createUse } from '../helpers/use';
import { defaultExtensions, defaultHelpers } from './core';
import type { Readable, Writable } from '@lattice/signals/types';
import type { RefSpec } from '../types';

export type { DOMAdapterConfig } from '../adapters/dom';

/**
 * Create DOM view service (view primitives only, no signals)
 *
 * Use this when you need to share signals between multiple adapters
 * (e.g., DOM + Canvas in the same app).
 *
 * @example
 * ```ts
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 * import { createDOMViewSvc } from '@lattice/view/presets/dom';
 *
 * const signals = createSignalsSvc();
 * const dom = createDOMViewSvc(signals);
 * const canvas = createCanvasViewSvc(signals);
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createDOMViewSvc = <
  TSignals extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
>(
  signals: TSignals
) => {
  const adapter = createDOMAdapter();
  const viewHelpers = defaultHelpers(adapter, signals);
  const viewSvc = composeFrom(
    defaultExtensions<DOMAdapterConfig>(),
    viewHelpers
  );

  const svc = {
    ...viewSvc,
    on: createAddEventListener(viewHelpers.batch),
  };

  return {
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

/**
 * Create a fully-configured DOM app service
 *
 * Returns a flat service with all signals and view primitives,
 * plus DOM-specific helpers (on, t) and a mount function.
 */
export const createDOMSvc = () => {
  const signals = createSignalsSvc();
  const dom = createDOMViewSvc(signals);
  const svc = {
    ...signals,
    ...dom,
  };

  return {
    ...svc,
    use: createUse(svc),
  };
};

/**
 * Type of the service returned by createDOMSvc
 */
export type DOMSvc = ReturnType<typeof createDOMSvc>;
export type DOMViewSvc = ReturnType<typeof createDOMViewSvc>;
export type DOMSignals = ReturnType<typeof createSignalsSvc>;
