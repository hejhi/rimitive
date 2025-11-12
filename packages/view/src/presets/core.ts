import { El } from '../el';
import { Map } from '../map';
import { On } from '../on';
import { Match } from '../match';
import { createSpec } from '../helpers';
import type {
  RendererConfig,
} from '../renderer';
import type { RefSpec, SealedSpec } from '../types';

export type { ElementProps, ChildrenApplicator } from '../el';
export type { ElFactory } from '../el';
export type { MapFactory } from '../map';
export type { OnFactory } from '../on';
export type { MatchFactory } from '../match';

export const defaultExtensions = <TConfig extends RendererConfig>() => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  on: On(),
  match: Match<TConfig>(),
});

/**
 * Component factory type - dynamically typed based on actual API
 */
export type ComponentFactory<TApi> = <TArgs extends unknown[], TElementResult>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<TElementResult>
) => (...args: TArgs) => SealedSpec<TElementResult>;

export const defaultHelpers = createSpec;
