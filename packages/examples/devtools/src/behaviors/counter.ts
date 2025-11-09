/**
 * Counter Behavior - Framework Agnostic
 *
 * A simple counter with derived values for doubled and isEven.
 * Demonstrates basic signal usage and computed values.
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI, SignalFunction, ComputedFunction } from '../types';

export interface CounterAPI {
  count: SignalFunction<number>;
  doubled: ComputedFunction<number>;
  isEven: ComputedFunction<boolean>;
  increment: () => void;
  decrement: () => void;
  set: (value: number) => void;
}

export const Counter = create((api: SignalsAPI) => (initialCount: number = 0): CounterAPI => {
  const count = api.signal(initialCount);
  const doubled = api.computed(() => count() * 2);
  const isEven = api.computed(() => count() % 2 === 0);

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
