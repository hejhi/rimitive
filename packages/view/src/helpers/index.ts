import { createScopes } from './scope';
import type {
  Renderer,
  RendererConfig,
} from '../renderer';
import type { ReactiveAdapter } from '../reactive-adapter';

export function createSpec<
  TConfig extends RendererConfig,
  >(
    renderer: Renderer<TConfig>,
    signals: ReactiveAdapter
) {
  return {
    renderer,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    effect: signals.effect,
    batch: signals.batch,
  };
}
