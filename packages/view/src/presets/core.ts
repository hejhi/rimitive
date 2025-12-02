import { El } from '../el';
import { Map } from '../map';
import { Match } from '../match';
import { When } from '../when';
import { createSpec } from '../helpers';
import type { Adapter, AdapterConfig } from '../adapter';
import type { RefSpec, NodeRef, ReactiveAdapter } from '../types';
import { composeFrom } from '@lattice/lattice';

export type { ElementProps, TagFactory } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { MatchFactory } from '../match';
export type { WhenFactory } from '../when';

export const defaultExtensions = <TConfig extends AdapterConfig>() => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  match: Match<TConfig>(),
  when: When<TConfig>(),
});

/**
 * Component factory type - dynamically typed based on actual API
 * Supports both RefSpec (elements) and NodeRef (fragments) returns
 * Preserves element type inference through TElement generic
 */
export type ComponentFactory<TApi> = <TArgs extends unknown[], TElement>(
  factory: (
    api: TApi
  ) => (...args: TArgs) => RefSpec<TElement> | NodeRef<TElement>
) => (...args: TArgs) => RefSpec<TElement>;

export const defaultHelpers = createSpec;

export const createViewApi = <TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>,
  signals: ReactiveAdapter
) =>
  composeFrom(defaultExtensions<TConfig>(), defaultHelpers(adapter, signals));
