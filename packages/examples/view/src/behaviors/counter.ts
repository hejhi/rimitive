/**
 * Counter Behavior - Framework Agnostic
 *
 * PATTERN: Component Pattern (see COMPONENT_PATTERN.md)
 * This is a headless component - pure logic with no UI concerns.
 * Can be used with any renderer (view, React, Vue, Svelte, etc.)
 */

import type { LatticeViewAPI } from '../types';
import type { Reactive } from '@lattice/view';

export interface CounterAPI {
  count: Reactive<number>;
  doubled: Reactive<number>;
  increment(): void;
  decrement(): void;
  reset(): void;
}

export function createCounter(api: LatticeViewAPI, initialCount = 0): CounterAPI {
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
}
