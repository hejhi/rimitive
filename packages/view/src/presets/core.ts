import { El } from '../el';
import { Map } from '../map';
import { Match } from '../match';
import { Portal } from '../portal';
import { createSpec } from '../helpers';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef, Readable, Writable } from '../types';
import { composeFrom } from '@lattice/lattice';

export type { ElementProps, TagFactory } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { MatchFactory } from '../match';
export type { PortalFactory } from '../portal';

export const defaultExtensions = <TConfig extends AdapterConfig>() => ({
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

export const defaultHelpers = createSpec;

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
) =>
  composeFrom(defaultExtensions<TConfig>(), defaultHelpers(adapter, signals));
