/**
 * Counter Behavior - Framework Agnostic
 *
 * A simple counter with derived values for doubled and isEven.
 * Demonstrates basic signal usage and computed values.
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI } from '../types';

export const Counter = create(({ signal, computed }: SignalsAPI) => (initialCount: number = 0) => {
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
});
