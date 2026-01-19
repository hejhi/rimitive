import { signal, computed } from '../service';

export const useCounter = (initialCount = 0) => {
  const count = signal(initialCount);
  const doubled = computed(() => count() * 2);

  return {
    count,
    doubled,

    // Actions
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initialCount),
  };
};
