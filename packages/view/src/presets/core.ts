import { El, type ElFactory, type ElOpts } from '../el';
import { Map, type MapFactory, type MapOpts } from '../map';
import { Match, type MatchFactory, type MatchOpts } from '../match';
import { Portal, type PortalFactory, type PortalOpts } from '../portal';
import { createScopes } from '../helpers/scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef, Readable, Writable } from '../types';
import { composeFrom, type Service } from '@lattice/lattice';

export type { ElementProps, TagFactory } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { MatchFactory } from '../match';
export type { PortalFactory } from '../portal';

export type DefaultExtensions<TConfig extends AdapterConfig> = {
  el: Service<ElFactory<TConfig>, ElOpts<TConfig>>;
  map: Service<MapFactory<TConfig['baseElement']>, MapOpts<TConfig>>;
  match: Service<MatchFactory<TConfig['baseElement']>, MatchOpts<TConfig>>;
  portal: Service<PortalFactory<TConfig['baseElement']>, PortalOpts<TConfig>>;
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
): ReturnType<typeof composeFrom<DefaultExtensions<TConfig>, ElOpts<TConfig> & MapOpts<TConfig> & MatchOpts<TConfig> & PortalOpts<TConfig>>> =>
  composeFrom(defaultExtensions<TConfig>(), {
    adapter,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
  });
