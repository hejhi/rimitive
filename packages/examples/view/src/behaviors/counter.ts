/**
 * Counter Behavior - Framework Agnostic
 *
 * Component Pattern (see COMPONENT_PATTERN.md)
 * This is a headless component - pure logic with no UI concerns.
 * Can be used with any signals implementation (Lattice, Solid, Preact Signals, etc.)
 */

import { create } from '@lattice/lattice';
import type { SignalsAPI, SignalFunction, ComputedFunction } from '../types';

export interface CounterAPI {
  count: SignalFunction<number>;
  doubled: ComputedFunction<number>;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const createCounter = create((api: SignalsAPI) => (initialCount: number = 0): CounterAPI => {
  const count = api.signal(initialCount);
  const doubled = api.computed(() => count() * 2);

  return {
    // Reactive state - expose signals directly
    count,
    doubled,

    // Actions - update state
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initialCount),
  };
});
