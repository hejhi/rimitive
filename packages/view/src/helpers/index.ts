import { createBaseContext } from '../context';
import { createScopes } from './scope';
import type {
  Renderer,
  RendererConfig,
} from '../renderer';
import { ExtensionsToContext } from '@lattice/lattice';
import { SignalFactory } from '@lattice/signals/signal';
import { EffectFactory } from '@lattice/signals/effect';
import { createPushSchedule } from '@lattice/signals/helpers';

export function createSpec<
  TConfig extends RendererConfig,
  >(
    renderer: Renderer<TConfig>,
    signals: {
      api: ExtensionsToContext<(SignalFactory | EffectFactory)[]>,
      deps: ReturnType<typeof createPushSchedule>
    },
    ctx = createBaseContext<TConfig['baseElement']>()
) {
  const { api, deps } = signals;
  const { ctx: signalsCtx, detachAll, track, ...restDeps } = deps;
  const { signal, effect } = api;
  const scopes = createScopes<TConfig['baseElement']>({
    ctx,
    detachAll,
    baseEffect: effect,
  });

  return {
    ctx,
    signalsCtx,
    track,
    renderer,
    ...scopes,
    signal,
    // Pass back user-provided deps in case they provide other reactives with context
    ...restDeps,
  };
}
