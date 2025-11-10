import { El } from '../el';
import { Map } from '../helpers/map';
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

export type { ElFactory } from '../el';
export type { MapFactory } from '../helpers/map';
export type { OnFactory } from '../on';
export type {
  RefSpec,
  SealedSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  Reactive,
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
  TElement extends RendererElement,
  TText extends TextNode,
>(
  renderer: Renderer<TConfig, TElement, TText>,
  ext = {
    el: El<TConfig, TElement, TText>(),
    map: Map<TConfig, TElement, TText>(),
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

  // Create a component factory typed with the actual API
  const create: ComponentFactory<typeof api> = (factory) => {
    return baseCreate(factory);
  };

  // Convenience method for mounting components with the bound extensions
  // This eliminates the need to manually call .create(extensions)
  const mount = <TElement>(spec: SealedSpec<TElement>): NodeRef<TElement> => {
    return spec.create(api);
  };

  return {
    api,
    create,
    mount,
  };
}
