/**
 * Counter Behavior - Framework Agnostic
 *
 * A simple counter with derived values for doubled and isEven.
 * Demonstrates basic signal usage and computed values.
 */
import type { Service } from '../service';

export const useCounter =
  (svc: Service) =>
  (initialCount = 0) => {
    const count = svc.signal(initialCount);
    const doubled = svc.computed(() => count() * 2);
    const isEven = svc.computed(() => count() % 2 === 0);

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
