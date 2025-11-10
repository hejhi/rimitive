import { createBaseContext } from '../context';
import { createScopes } from './scope';
import type {
  Renderer,
  Element as RendererElement,
  TextNode,
  RendererConfig,
} from '../renderer';
import { createProcessChildren } from './processChildren';
import { ExtensionsToContext } from '@lattice/lattice';
import { SignalFactory } from '@lattice/signals/signal';
import { EffectFactory } from '@lattice/signals/effect';
import { createPushSchedule } from '@lattice/signals/helpers';

export function createSpec<
  TConfig extends RendererConfig,
  TElement extends RendererElement,
  TText extends TextNode,
  >(
    renderer: Renderer<TConfig, TElement, TText>,
    reactives: {
      extensions: ExtensionsToContext<(SignalFactory | EffectFactory)[]>,
      deps: ReturnType<typeof createPushSchedule>
    },
    ctx = createBaseContext<TElement>()
) {
  const { extensions, deps } = reactives;
  const { ctx: signalCtx, track, dispose, ...depsRest } = deps;
  const scopes = createScopes<TElement>({
    ctx,
    track,
    dispose,
    baseEffect: extensions.effect,
  });

  const { processChildren } = createProcessChildren<TConfig, TElement, TText>({
    scopedEffect: scopes.scopedEffect,
    renderer,
  });

  return {
    ctx,
    // TODO: rename to reactiveCtx or merge into ctx
    signalCtx,
    track,
    renderer,
    processChildren,
    ...scopes,
    ...extensions,
    ...depsRest,
  };
}
