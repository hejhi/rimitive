/**
 * Counter Behavior - Framework Agnostic
 *
 * Component Pattern (see COMPONENT_PATTERN.md)
 * This is a headless component - pure logic with no UI concerns.
 * Can be used with any signals implementation (Lattice, Solid, Preact Signals, etc.)
 */
import { Signals } from '../create';

export const createCounter = ({ signal, computed }: Pick<Signals, 'signal' | 'computed'>, initialCount = 0) => {
  const count = signal(initialCount);
  const doubled = computed(() => count() * 2);

  return {
    // Reactive state - expose signals directly
    count,
    doubled,

    // Actions - update state
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initialCount),
  };
};
