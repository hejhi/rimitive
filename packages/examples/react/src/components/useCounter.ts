/**
 * Counter Component - React Version
 *
 * Returns actual signal/computed functions for use with useSubscribe
 */

import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';

export interface UseCounter {
  count: SignalFunction<number>;
  doubled: ComputedFunction<number>;
  isEven: ComputedFunction<boolean>;
  increment(): void;
  decrement(): void;
  set(value: number): void;
}

export function useCounter(api: {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(compute: () => T) => ComputedFunction<T>;
}): UseCounter {
  const count = api.signal(0);
  const doubled = api.computed(() => count() * 2);
  const isEven = api.computed(() => count() % 2 === 0);

  return {
    // Signals/Computed - for useSubscribe
    count,
    doubled,
    isEven,

    // Actions
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    set: (value: number) => count(value),
  };
}
