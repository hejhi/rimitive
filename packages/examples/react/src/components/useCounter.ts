/**
 * Counter Behavior - React Version
 *
 * A simple counter with derived values for doubled and isEven.
 * Used with useComponent to create isolated instances per React component.
 */
import type { Service } from '../service';

export const useCounter = (api: Service, initialCount = 0) => {
  const count = api.signal(initialCount);
  const doubled = api.computed(() => count() * 2);
  const isEven = api.computed(() => count() % 2 === 0);

  return {
    // Reactive state
    count,
    doubled,
    isEven,

    // Actions
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    set: (value: number) => count(value),
  };
};
