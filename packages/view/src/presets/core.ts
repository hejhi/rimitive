import { El, type ElService } from '../el';
import { Map, type MapService } from '../map';
import { Match, type MatchService } from '../match';
import { Portal, type PortalService } from '../portal';
import { createScopes } from '../helpers/scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef, Readable, Writable } from '../types';
import { compose, type Svc } from '@lattice/lattice';

// Re-export user-facing types for convenience
export type { ElementProps, TagFactory, ElFactory, ElService } from '../el';
export type { MapFactory, MapService } from '../map';
export type { MatchFactory, MatchService } from '../match';
export type { PortalFactory, PortalService } from '../portal';

/**
 * The set of instantiable services created by defaultExtensions().
 *
 * Each property is a service that can be composed with compose().
 * Use this type when extending the default view primitives.
 *
 * @example
 * ```ts
 * import { defaultExtensions, type DefaultExtensions } from '@lattice/view/presets/core';
 *
 * const extensions: DefaultExtensions<DOMAdapterConfig> = defaultExtensions();
 * // extensions.el, extensions.map, etc. are all services
 * ```
 */
export type DefaultExtensions<TConfig extends AdapterConfig> = {
  el: ElService<TConfig>;
  map: MapService<TConfig>;
  match: MatchService<TConfig>;
  portal: PortalService<TConfig>;
};

export const defaultExtensions = <TConfig extends AdapterConfig>(): DefaultExtensions<TConfig> => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  match: Match<TConfig>(),
  portal: Portal<TConfig>(),
});

/**
 * Component factory type - dynamically typed based on actual service
 * Supports both RefSpec (elements) and NodeRef (fragments) returns
 * Preserves element type inference through TElement generic
 */
export type ComponentFactory<TSvc> = <TArgs extends unknown[], TElement>(
  factory: (
    svc: TSvc
  ) => (...args: TArgs) => RefSpec<TElement> | NodeRef<TElement>
) => (...args: TArgs) => RefSpec<TElement>;

/**
 * View service type for a given adapter config
 */
export type ViewSvc<TConfig extends AdapterConfig> = Svc<DefaultExtensions<TConfig>>;

export const createViewSvc = <
  TConfig extends AdapterConfig,
  TSignals extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
>(
  adapter: Adapter<TConfig>,
  signals: TSignals
): ViewSvc<TConfig> =>
  compose(defaultExtensions<TConfig>(), {
    adapter,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
  });
