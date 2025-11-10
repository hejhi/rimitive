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
    signals: {
      api: ExtensionsToContext<(SignalFactory | EffectFactory)[]>,
      deps: ReturnType<typeof createPushSchedule>
    },
    ctx = createBaseContext<TElement>()
) {
  const { api, deps } = signals;
  const { ctx: signalCtx, track, dispose, ...restDeps } = deps;
  const { signal, effect } = api;
  const scopes = createScopes<TElement>({
    ctx,
    track,
    dispose,
    baseEffect: effect,
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
    signal,
    // Pass back user-provided deps in case they provide other reactives with context
    ...restDeps
  };
}
