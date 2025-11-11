import { El } from '../el';
import { Map } from '../map';
import { On } from '../on';
import {
  CreateContextOptions,
  createApi as createLatticeApi,
} from '@lattice/lattice';
import { createSpec } from '../helpers';
import type {
  Renderer,
  RendererConfig,
} from '../renderer';
import type { ReactiveAdapter } from '../reactive-adapter';
import { create as baseCreate } from '../component';
import type { RefSpec, SealedSpec, NodeRef } from '../types';

export const extensions = {
  el: El(),
  map: Map(),
  on: On(),
};

/**
 * Component factory type - dynamically typed based on actual API
 */
export type ComponentFactory<TApi> = <TArgs extends unknown[], TElementResult>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<TElementResult>
) => (...args: TArgs) => SealedSpec<TElementResult>;

export function createApi<TConfig extends RendererConfig>(
  renderer: Renderer<TConfig>,
  ext = {
    el: El<TConfig>(),
    map: Map<TConfig>(),
    on: On(),
  },
  signalsApi: ReactiveAdapter,
  opts?: CreateContextOptions
) {
  // Merge signals and view apis first
  const api = {
    ...signalsApi,
    ...createLatticeApi(
      { ...extensions, ...ext },
      createSpec(renderer, signalsApi),
      opts
    ),
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
} from '../types';