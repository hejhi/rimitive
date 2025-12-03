/**
 * DOM App Preset
 *
 * Pre-configured bundle for building DOM-based apps.
 * Combines signals, view primitives, and DOM-specific helpers.
 *
 * @example
 * ```ts
 * import { createDOMApp } from '@lattice/view/presets/dom';
 *
 * const { el, signal, computed, on, t, mount } = createDOMApp();
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
import type { RefSpec } from '../types';

export type { DOMAdapterConfig } from '../adapters/dom';

const createViewSvc = (
  helpers: ReturnType<typeof defaultHelpers<DOMAdapterConfig>>
) => {
  return composeFrom(defaultExtensions<DOMAdapterConfig>(), helpers);
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
 * const { el, signal, on, mount } = createDOMApp();
 *
 * // Or export everything for component files
 * export const { svc, mount, signal, computed, effect, batch, el, map, match, on, t } = createDOMApp();
 * ```
 */
export const createDOMSvc = () => {
  // Create signals service
  const signalsSvc = createSignalsApi();

  // Create DOM adapter and view service
  const adapter = createDOMAdapter();
  const viewHelpers = defaultHelpers(adapter, signalsSvc);
  const viewSvc = createViewSvc(viewHelpers);

  // Combined flat service
  const svc = {
    ...signalsSvc,
    ...viewSvc,
    on: createAddEventListener(viewHelpers.batch),
    t: createText(signalsSvc.computed),
  };

  return {
    // Structured service (for passing to behaviors, etc.)
    ...svc,
    // Mount function
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

/**
 * Type of the service returned by createDOMApp
 */
export type DOMSvc = ReturnType<typeof createDOMSvc>;
export type DOMSignals = ReturnType<typeof createSignalsApi>;
export type DOMView = ReturnType<typeof createViewSvc>;
