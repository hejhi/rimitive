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

import { compose, type LatticeContext, type Use } from '@lattice/lattice';
import {
  createSignalsSvc,
  type SignalsSvc,
} from '@lattice/signals/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '../adapters/dom';
import {
  createAddEventListener,
  type AddEventListener,
} from '../helpers/addEventListener';
import { createScopes } from '../helpers/scope';
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
 *
 * @example
 * ```typescript
 * import type { ViewSvc } from '@lattice/view/presets/dom';
 *
 * const viewContext: ViewSvc = compose(defaultExtensions(), helpers);
 * const { el, map, match, portal } = viewContext;
 * ```
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
 *
 * @example
 * ```typescript
 * import { createDOMViewSvc, type DOMViewSvc } from '@lattice/view/presets/dom';
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 *
 * const signals = createSignalsSvc();
 * const view: DOMViewSvc = createDOMViewSvc(signals);
 * const { el, map, on, mount } = view;
 * ```
 */
export type DOMViewSvc = ViewSvc & {
  on: AddEventListener;
  mount: <TElement>(spec: RefSpec<TElement>) => NodeRef<TElement>;
};

/**
 * Full DOM service type - signals + view + on + mount
 *
 * @example
 * ```typescript
 * import { createDOMSvc, type DOMSvc } from '@lattice/view/presets/dom';
 *
 * const use = createDOMSvc();
 * const { signal, computed, el, map, match, on, mount } = use();
 * ```
 */
export type DOMSvc = SignalsSvc & DOMViewSvc;

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
>({
  signal,
  computed,
  effect,
  batch,
}: TSignals): DOMViewSvc => {
  const adapter = createDOMAdapter();
  const viewHelpers = {
    adapter,
    ...createScopes({ baseEffect: effect }),
    signal,
    computed,
    effect,
    batch,
  };
  const viewSvc = compose(defaultExtensions<DOMAdapterConfig>(), viewHelpers)();

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
 * Returns a `use()` function that provides access to all signals and view primitives,
 * plus DOM-specific helpers (on) and a mount function.
 *
 * @example
 * ```typescript
 * import { createDOMSvc } from '@lattice/view/presets/dom';
 *
 * const use = createDOMSvc();
 * const { el, signal, computed, map, on, mount } = use();
 *
 * const App = () => {
 *   const count = signal(0);
 *   return el('div')(
 *     el('h1')('Counter'),
 *     el('p')(computed(() => `Count: ${count()}`)),
 *     el('button').ref(on('click', () => count(c => c + 1)))('Increment')
 *   );
 * };
 *
 * document.body.appendChild(mount(App()));
 * ```
 *
 * @example Using with callback pattern
 * ```typescript
 * const use = createDOMSvc();
 *
 * // Wrap a component with service access
 * const Counter = use(({ signal, el, on }) => () => {
 *   const count = signal(0);
 *   return el('button').ref(on('click', () => count(c => c + 1)))(
 *     computed(() => `Count: ${count()}`)
 *   );
 * });
 * ```
 */
export const createDOMSvc = (): Use<DOMSvc> => {
  const signals = createSignalsSvc()();
  const dom = createDOMViewSvc(signals);
  const svc: DOMSvc = {
    ...signals,
    ...dom,
  };

  // Return a use() function
  function use(): DOMSvc;
  function use<TResult>(callback: (svc: DOMSvc) => TResult): TResult;
  function use<TResult>(callback?: (svc: DOMSvc) => TResult): DOMSvc | TResult {
    if (callback === undefined) {
      return svc;
    }
    return callback(svc);
  }

  return use;
};

// Re-export SignalsSvc as DOMSignals for convenience
export type DOMSignals = SignalsSvc;
