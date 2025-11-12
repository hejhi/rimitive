/**
 * Counter Behavior - Framework Agnostic
 *
 * A simple counter with derived values for doubled and isEven.
 * Demonstrates basic signal usage and computed values.
 */

import { Signals } from '../api';

export const createCounter = (
  { signal, computed }: Pick<Signals, 'signal' | 'computed'>, initialCount = 0
) => {
  const count = signal(initialCount);
  const doubled = computed(() => count() * 2);
  const isEven = computed(() => count() % 2 === 0);

  return {
    // Reactive state - expose signals directly
    count,
    doubled,
    isEven,

    // Actions - update state
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    set: (value: number) => count(value),
  };
};
