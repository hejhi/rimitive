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
    }
) {
  const { api, deps } = signals;
  const { consumer, track, ...restDeps } = deps;
  const { signal, effect } = api;
  const scopes = createScopes({
    baseEffect: effect,
  });

  return {
    consumer,
    track,
    renderer,
    ...scopes,
    signal,
    // Pass back user-provided deps in case they provide other reactives with context
    ...restDeps,
  };
}
