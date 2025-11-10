import { El } from '../el';
import { Map } from '../helpers/map';
import { On } from '../on';
import { createApi as createlatticeApi } from '@lattice/lattice';
import { createSpec } from '../helpers';
import type {
  Renderer,
  RendererConfig,
  Element as RendererElement,
  TextNode,
} from '../renderer';
import { create as createReactives } from '@lattice/signals/presets/core';
import { create as baseCreate, type LatticeViewAPI } from '../component';
import type { RefSpec, SealedSpec } from '../types';

export {
  Renderer,
  RendererConfig,
  RendererElement,
  TextNode,
};

export type { ElFactory } from '../el';
export type { MapFactory } from '../helpers/map';
export type { OnFactory } from '../on';

export const extensions = {
  el: El(),
  map: Map(),
  on: On(),
};

/**
 * Component factory type - pre-typed with renderer configuration
 */
export type ComponentFactory<TConfig extends RendererConfig, TElement extends RendererElement> = <
  TArgs extends unknown[],
  TElementResult
>(
  factory: (api: LatticeViewAPI<TConfig, TElement>) => (...args: TArgs) => RefSpec<TElementResult>
) => (...args: TArgs) => SealedSpec<TElementResult>;

export function createApi<
  TConfig extends RendererConfig,
  TElement extends RendererElement,
  TText extends TextNode,
>(
  renderer: Renderer<TConfig, TElement, TText>,
  ext = extensions,
  deps = createReactives()
) {
  const extensionsApi = createlatticeApi(
    { ...extensions, ...ext },
    createSpec(renderer, deps)
  );

  // Create a renderer-specific component factory
  // This automatically provides type information based on the renderer
  const create: ComponentFactory<TConfig, TElement> = <TArgs extends unknown[], TElementResult>(
    factory: (api: LatticeViewAPI<TConfig, TElement>) => (...args: TArgs) => RefSpec<TElementResult>
  ): ((...args: TArgs) => SealedSpec<TElementResult>) => {
    return baseCreate<TArgs, TElementResult, TConfig, TElement>(factory);
  };

  return {
    extensions: extensionsApi,
    deps,
    create,
  };
}
