import { El } from '../el';
import { Map } from '../map';
import { Match } from '../match';
import { Show } from '../show';
import { createSpec } from '../helpers';
import type { Renderer, RendererConfig } from '../renderer';
import type { RefSpec, NodeRef, ReactiveAdapter } from '../types';
import { composeFrom } from '@lattice/lattice';

export type { ElementProps, ChildrenApplicator } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { MatchFactory } from '../match';
export type { ShowFactory } from '../show';

export const defaultExtensions = <TConfig extends RendererConfig>() => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  match: Match<TConfig>(),
  show: Show<TConfig>(),
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

export const createViewApi = <TConfig extends RendererConfig>(
  renderer: Renderer<TConfig>,
  signals: ReactiveAdapter
) =>
  composeFrom(defaultExtensions<TConfig>(), defaultHelpers(renderer, signals));
