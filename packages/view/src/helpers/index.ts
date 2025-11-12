import { createScopes } from './scope';
import { createAddEventListener } from './addEventListener';
import type {
  Renderer,
  RendererConfig,
} from '../renderer';
import type { ReactiveAdapter } from '../reactive-adapter';

export function createSpec<
  TConfig extends RendererConfig,
  >(
    renderer: Renderer<TConfig>,
    reactive: ReactiveAdapter
) {
  const scopes = createScopes({
    baseEffect: reactive.effect,
  });

  return {
    renderer,
    ...scopes,
    // Reactive primitives required by view
    signal: reactive.signal,
    effect: reactive.effect,
    batch: reactive.batch,
    // DOM helpers
    addEventListener: createAddEventListener(reactive.batch),
  };
}
