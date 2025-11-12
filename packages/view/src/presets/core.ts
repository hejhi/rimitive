import { El } from '../el';
import { Map } from '../map';
import { On } from '../on';
import { Match } from '../match';
import {
  CreateContextOptions,
  createApi as createLatticeApi,
  Instantiatable,
} from '@lattice/lattice';
import { createSpec } from '../helpers';
import type {
  Renderer,
  RendererConfig,
} from '../renderer';
import type { ReactiveAdapter } from '../reactive-adapter';
import { create as baseCreate } from '../component';
import type { RefSpec, SealedSpec, NodeRef } from '../types';

export type { ElementProps, ChildrenApplicator } from '../el';
export type { MatchFactory } from '../match';

export const defaultExtensions = <TConfig extends RendererConfig, TApi = unknown>(
  ext?: Record<string, Instantiatable<RefSpec<TConfig['baseElement']>, TApi>>
) => ({
  el: El<TConfig>(),
  map: Map<TConfig>(),
  on: On(),
  match: Match<TConfig>(),
  ...ext,
});

/**
 * Component factory type - dynamically typed based on actual API
 */
export type ComponentFactory<TApi> = <TArgs extends unknown[], TElementResult>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<TElementResult>
) => (...args: TArgs) => SealedSpec<TElementResult>;

export function createApi<
  TConfig extends RendererConfig,
  TReactive extends ReactiveAdapter,
>(
  renderer: Renderer<TConfig>,
  extensions = defaultExtensions<TConfig>(),
  signals: TReactive,
  opts?: CreateContextOptions
) {
  const api = {
    ...signals,
    ...createLatticeApi(extensions, createSpec(renderer, signals), opts),
  };

  const mount = <TElement>(spec: SealedSpec<TElement>): NodeRef<TElement> =>
    spec.create(api);

  return {
    api,
    create: baseCreate as ComponentFactory<typeof api>,
    mount,
  };
}

export type {
  RefSpec,
  SealedSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  Reactive,
  Readable,
  Writable
} from '../types';

export type { ReactiveAdapter };