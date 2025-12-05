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

import { compose, type LatticeContext } from '@lattice/lattice';
import { createSignalsSvc, type SignalsSvc } from '@lattice/signals/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '../adapters/dom';
import {
  createAddEventListener,
  type AddEventListener,
} from '../helpers/addEventListener';
import { createScopes } from '../helpers/scope';
import { createUse, type Use } from '../helpers/use';
import { defaultExtensions } from './core';
import type { Readable, Writable } from '@lattice/signals/types';
import type { NodeRef, RefSpec } from '../types';
import type {
  ElFactory,
  MapFactory,
  MatchFactory,
  PortalFactory,
} from './core';

export type { DOMAdapterConfig } from '../adapters/dom';

/**
 * View service type - composed from defaultExtensions
 */
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
 */
export type DOMViewSvc = ViewSvc & {
  on: AddEventListener;
  mount: <TElement>(spec: RefSpec<TElement>) => NodeRef<TElement>;
};

/**
 * Full DOM service type - signals + view + use
 */
export type DOMSvc = SignalsSvc & DOMViewSvc & { use: Use<SignalsSvc & DOMViewSvc> };

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
): DOMViewSvc => {
  const adapter = createDOMAdapter();
  const viewHelpers = {
    adapter,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
  };
  const viewSvc = compose(
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
export const createDOMSvc = (): DOMSvc => {
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

// Re-export SignalsSvc as DOMSignals for convenience
export type DOMSignals = SignalsSvc;
