import { createScopes } from './scope';
import type { Adapter, AdapterConfig } from '../adapter';
import type { Readable, Writable } from '@lattice/signals/types';

export function createSpec<
  TConfig extends AdapterConfig,
  TSignals extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  }
>(adapter: Adapter<TConfig>, signals: TSignals) {
  return {
    adapter,
    ...createScopes({ baseEffect: signals.effect }),
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
  };
}
