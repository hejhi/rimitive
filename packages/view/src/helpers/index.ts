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
    reactive: ReactiveAdapter,
    // Optional: full context for power users who need access to raw internals
    extensions?: Record<string, unknown>
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
    // Optional: expose additional extensions for power users
    ...(extensions ?? {}),
  };
}
