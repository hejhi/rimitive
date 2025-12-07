import { El, type ElService } from '../el';
import { Map, type MapService } from '../map';
import { Match, type MatchService } from '../match';
import { Portal, type PortalService } from '../portal';
import { createScopes } from '../deps/scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef } from '../types';
import { compose, type Svc, type Use, extend } from '@lattice/lattice';
import { createSignalsSvc, SignalsSvc } from '@lattice/signals/presets/core';

// Re-export user-facing types for convenience
export type { ElementProps, TagFactory, ElFactory, ElService } from '../el';
export type { MapFactory, MapService } from '../map';
export type { MatchFactory, MatchService } from '../match';
export type { PortalFactory, PortalService } from '../portal';

/**
 * Component factory type - dynamically typed based on actual service
 * Supports both RefSpec (elements) and NodeRef (fragments) returns
 * Preserves element type inference through TElement generic
 *
 * @example
 * ```typescript
 * import type { ComponentFactory } from '@lattice/view/presets/core';
 * import type { DOMSvc } from '@lattice/view/presets/dom';
 *
 * const component: ComponentFactory<DOMSvc> = (svc) => (name: string) => {
 *   return svc.el('div')(`Hello, ${name}`);
 * };
 * ```
 */
export type ComponentFactory<TSvc> = <TArgs extends unknown[], TElement>(
  factory: (
    svc: TSvc
  ) => (...args: TArgs) => RefSpec<TElement> | NodeRef<TElement>
) => (...args: TArgs) => RefSpec<TElement>;

/**
 * View service type for a given adapter config
 *
 * @example
 * ```typescript
 * import type { ViewSvc } from '@lattice/view/presets/core';
 * import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
 *
 * const view: ViewSvc<DOMAdapterConfig> = createViewSvc(adapter, signals);
 * const { el, map, match, portal } = view;
 * ```
 */
export type ViewSvc<TConfig extends AdapterConfig> = SignalsSvc &
  Svc<{
    el: ElService<TConfig>;
    map: MapService<TConfig>;
    match: MatchService<TConfig>;
    portal: PortalService<TConfig>;
  }>;

/**
 * Create a view service for a given adapter and optional signal implementation
 *
 * Combines the default view primitives (el, map, match, portal) with an adapter
 * and signal system to create a complete view service.
 *
 * @param adapter - The adapter for the target platform (DOM, canvas, etc.)
 * @param signals - Optional signals service. If not provided, creates a new one.
 *
 * @example With auto-created signals
 * ```typescript
 * import { createViewSvc } from '@lattice/view/presets/core';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const view = createViewSvc(adapter);
 *
 * const { el, signal, computed } = view();
 * ```
 *
 * @example With shared signals (for islands/SSR)
 * ```typescript
 * import { createViewSvc } from '@lattice/view/presets/core';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 *
 * const signals = createSignalsSvc()();
 * const adapter = createDOMAdapter();
 * const view = createViewSvc(adapter, signals);
 *
 * const { el, map, match, portal } = view();
 * ```
 */
export const createViewSvc = <TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Use<ViewSvc<TConfig>> => {
  const signalsSvc = createSignalsSvc()();
  const defaultViewSvc = compose(
    {
      el: El<TConfig>(),
      map: Map<TConfig>(),
      match: Match<TConfig>(),
      portal: Portal<TConfig>(),
    },
    {
      adapter,
      signal: signalsSvc.signal,
      computed: signalsSvc.computed,
      ...createScopes({ baseEffect: signalsSvc.effect }),
    }
  );

  return extend(defaultViewSvc, (svc) => ({
    ...svc,
    ...signalsSvc,
  }));
};
