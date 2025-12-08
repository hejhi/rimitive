import { createElFactory, type ElFactory } from '../el';
import { createMapFactory, type MapFactory } from '../map';
import { createMatchFactory, type MatchFactory } from '../match';
import { createPortalFactory, type PortalFactory } from '../portal';
import { createScopes } from '../deps/scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef } from '../types';
import type { Use } from '@lattice/lattice';
import type { SignalsSvc } from '@lattice/signals/presets/core';

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
 * import type { DOMViewSvc } from '@lattice/view/presets/dom';
 *
 * const component: ComponentFactory<DOMViewSvc> = (svc) => (name: string) => {
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
 * const view: ViewSvc<DOMAdapterConfig> = createView(adapter, signals);
 * const { el, map, match, portal } = view;
 * ```
 */
export type ViewSvc<TConfig extends AdapterConfig> = SignalsSvc & {
  el: ElFactory<TConfig>;
  map: MapFactory<TConfig['baseElement']>;
  match: MatchFactory<TConfig['baseElement']>;
  portal: PortalFactory<TConfig['baseElement']>;
  dispose(): void;
};

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
 * import { createView } from '@lattice/view/presets/core';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const view = createView(adapter);
 *
 * const { el, signal, computed } = view();
 * ```
 *
 * @example With shared signals (for islands/SSR)
 * ```typescript
 * import { createView } from '@lattice/view/presets/core';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const signals = createSignals()();
 * const adapter = createDOMAdapter();
 * const view = createView(adapter, signals);
 *
 * const { el, map, match, portal } = view();
 * ```
 */
export const createView = <TConfig extends AdapterConfig>({
  adapter,
  signals,
}: {
  adapter: Adapter<TConfig>;
  signals: Use<SignalsSvc>;
}): Use<ViewSvc<TConfig>> => {
  const signalsSvc = signals();

  // Create scope management
  const scopes = createScopes({ baseEffect: signalsSvc.effect });

  // Create view primitives with deps
  const el = createElFactory<TConfig>({
    adapter,
    scopedEffect: scopes.scopedEffect,
    createElementScope: scopes.createElementScope,
    onCleanup: scopes.onCleanup,
  });

  const map = createMapFactory<TConfig>({
    adapter,
    signal: signalsSvc.signal,
    computed: signalsSvc.computed,
    scopedEffect: scopes.scopedEffect,
    disposeScope: scopes.disposeScope,
    getElementScope: scopes.getElementScope,
  });

  const match = createMatchFactory<TConfig>({
    adapter,
    scopedEffect: scopes.scopedEffect,
    disposeScope: scopes.disposeScope,
    getElementScope: scopes.getElementScope,
  });

  const portal = createPortalFactory<TConfig>({
    adapter,
    scopedEffect: scopes.scopedEffect,
    disposeScope: scopes.disposeScope,
    getElementScope: scopes.getElementScope,
  })(); // Note: portal factory returns a curried function, call with no props

  // Build the service object
  const svc: ViewSvc<TConfig> = {
    ...signalsSvc,
    el,
    map,
    match,
    portal,
    dispose: () => {
      signalsSvc.dispose();
    },
  };

  // Return a Use function
  const use = <TResult>(
    callback?: (ctx: ViewSvc<TConfig>) => TResult
  ): ViewSvc<TConfig> | TResult => {
    if (callback === undefined) {
      return svc;
    }
    return callback(svc);
  };

  return use as Use<ViewSvc<TConfig>>;
};
