import { El } from '../el';
import { Map } from '../helpers/map';
import { createApi } from '@lattice/lattice';
import { createSpec } from '../helpers';
import type {
  Renderer,
  RendererConfig,
  Element as RendererElement,
  TextNode,
} from '../renderer';
import { create as createReactives } from '@lattice/signals/presets/core'

export const extensions = {
  el: El(),
  map: Map(),
};

export function create<
  TConfig extends RendererConfig,
  TElement extends RendererElement,
  TText extends TextNode,
>(
  renderer: Renderer<TConfig, TElement, TText>,
  ext = extensions,
  deps = createReactives()
) {
  return {
    extensions: createApi(
      { ...extensions, ...ext },
      createSpec(renderer, deps)
    ),
    deps,
  };
}
