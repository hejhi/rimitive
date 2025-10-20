/**
 * Counter Component
 *
 * A simple counter with derived values for doubled and isEven.
 * Demonstrates basic signal usage and computed values.
 */

import type { Writable, Readable } from '@lattice/signals/types';

export interface CounterAPI {
  count(): number;
  doubled(): number;
  isEven(): boolean;
  increment(): void;
  decrement(): void;
  set(value: number): void;
}

export function createCounter(api: {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(compute: () => T) => Readable<T>;
}): CounterAPI {
  const count = api.signal(0);
  const doubled = api.computed(() => count() * 2);
  const isEven = api.computed(() => count() % 2 === 0);

  return {
    // Getters
    count: () => count(),
    doubled: () => doubled(),
    isEven: () => isEven(),

    // Actions
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    set: (value: number) => count(value),
  };
}
