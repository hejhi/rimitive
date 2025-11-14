import { El } from '../el';
import { Map } from '../map';
import { Match } from '../match';
import { createSpec } from '../helpers';
import type {
  RendererConfig,
} from '../renderer';
import type { RefSpec, SealedSpec, NodeRef } from '../types';

export type { ElementProps, ChildrenApplicator } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { MatchFactory } from '../match';

export const defaultExtensions = <TConfig extends RendererConfig>() => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  match: Match<TConfig>(),
});

/**
 * Component factory type - dynamically typed based on actual API
 * Supports both RefSpec (elements) and NodeRef (fragments) returns
 */
export type ComponentFactory<TApi> = <TArgs extends unknown[]>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<unknown> | NodeRef<unknown>
) => (...args: TArgs) => SealedSpec<unknown>;

export const defaultHelpers = createSpec;
