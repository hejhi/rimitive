/**
 * DOM App Preset
 *
 * Pre-configured bundle for building DOM-based apps.
 * Combines signals, view primitives, and DOM-specific deps.
 *
 * @example
 * ```ts
 * import { createDOMView } from '@lattice/view/presets/dom';
 *
 * const { el, signal, computed, on, mount } = createDOMView();
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

import { extend, type LatticeContext, type Use } from '@lattice/lattice';
import { type SignalsSvc } from '@lattice/signals/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '../adapters/dom';
import {
  createAddEventListener,
  type AddEventListener,
} from '../deps/addEventListener';
import { createView } from './core';
import type { NodeRef, RefSpec } from '../types';
import type {
  ElFactory,
  MapFactory,
  MatchFactory,
  PortalFactory,
} from './core';

export type { DOMAdapterConfig } from '../adapters/dom';

export type ViewSvc = LatticeContext<
  [
    ElFactory<DOMAdapterConfig>,
    MapFactory<HTMLElement>,
    MatchFactory<HTMLElement>,
    PortalFactory<HTMLElement>,
  ]
>;

/**
 * DOM View service type - view primitives + on + mount
 *
 * @example
 * ```typescript
 * import { createDOMView, type DOMViewSvc } from '@lattice/view/presets/dom';
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const signals = createSignals();
 * const view = createDOMView(signals());
 * const { el, map, on, mount } = view();
 * ```
 */
export type DOMViewSvc = ViewSvc &
  SignalsSvc & {
    on: AddEventListener;
    mount: <TElement>(spec: RefSpec<TElement>) => NodeRef<TElement>;
  };

/**
 * Full DOM service type - signals + view + on + mount
 *
 * @example
 * ```typescript
 * import { createDOMView, type DOMSvc } from '@lattice/view/presets/dom';
 *
 * const use = createDOMView();
 * const { signal, computed, el, map, match, on, mount } = use();
 * ```
 */
export type DOMSvc = SignalsSvc & DOMViewSvc;

/**
 * Create DOM view service (view primitives + on + mount)
 *
 * Use this when you need to share signals between multiple adapters
 * (e.g., DOM + Canvas in the same app).
 *
 * @param signals - Optional signals service. If not provided, creates a new one.
 *
 * @example With shared signals
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createDOMView } from '@lattice/view/presets/dom';
 *
 * const signals = createSignals()();
 * const dom = createDOMView(signals);
 * const canvas = createCanvasViewSvc(signals);
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createDOMView = ({
  signals,
}: {
  signals: Use<SignalsSvc>;
}): Use<DOMViewSvc> => {
  const adapter = createDOMAdapter();
  const viewSvc = createView({ adapter, signals });
  const withOn = extend(viewSvc, (svc) => ({
    ...svc,
    on: createAddEventListener(svc.batch),
  }));

  return extend(withOn, (svc) => ({
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  }));
};

// Re-export SignalsSvc as DOMSignals for convenience
export type DOMSignals = SignalsSvc;
