import { El } from '../el';
import { Map } from '../map';
import { On } from '../on';
import { CreateContextOptions, createApi as createLatticeApi } from '@lattice/lattice';
import { createSpec } from '../helpers';
import type {
  Renderer,
  RendererConfig,
  Element as RendererElement,
  TextNode,
} from '../renderer';
import { createApi as createReactiveApi } from '@lattice/signals/presets/core';
import { create as baseCreate } from '../component';
import type { RefSpec, SealedSpec, NodeRef } from '../types';

export {
  Renderer,
  RendererConfig,
  RendererElement,
  TextNode,
};

export type {
  ElFactory,
  ElOpts,
  ElProps,
  ChildrenApplicator,
  ElementProps,
  ReactiveElSpec
} from '../el';
export type { MapFactory, MapHelperOpts, MapProps } from '../map';
export type { OnFactory, OnOpts, OnProps } from '../on';
export type {
  RefSpec,
  SealedSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  Reactive,
  ElRefSpecChild,
  LifecycleCallback,
} from '../types';

export const extensions = {
  el: El(),
  map: Map(),
  on: On(),
};

/**
 * Component factory type - dynamically typed based on actual API
 */
export type ComponentFactory<TApi> = <
  TArgs extends unknown[],
  TElementResult
>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<TElementResult>
) => (...args: TArgs) => SealedSpec<TElementResult>;

export function createApi<
  TConfig extends RendererConfig,
>(
  renderer: Renderer<TConfig>,
  ext = {
    el: El<TConfig>(),
    map: Map<TConfig>(),
    on: On(),
  },
  signalsApi = createReactiveApi(),
  opts?: CreateContextOptions
) {
  // Merge signals and view apis first
  const api = {
    ...signalsApi.api,
    ...createLatticeApi(
      { ...extensions, ...ext },
      createSpec(renderer, signalsApi),
      opts
    ),
  };

  const mount =
    <TElement>(spec: SealedSpec<TElement>): NodeRef<TElement> => spec.create(api);

  return {
    api,
    create: baseCreate as ComponentFactory<typeof api>,
    mount,
  };
}
