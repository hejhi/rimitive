import { createScopes } from './scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { ReactiveAdapter } from '../reactive-adapter';

export function createSpec<TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>,
  signals: ReactiveAdapter
) {
  return {
    adapter,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
  };
}
