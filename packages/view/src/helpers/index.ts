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
  const scopes = createScopes({
    baseEffect: signals.effect,
  });

  return {
    renderer,
    ...scopes,
    // Reactive primitives required by view
    signal: signals.signal,
    effect: signals.effect,
    batch: signals.batch,
  };
}
