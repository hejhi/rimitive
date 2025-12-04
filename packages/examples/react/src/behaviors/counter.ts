import type { SignalsApi, Signal, Computed } from './types';

export type CounterOptions = {
  initialCount?: number;
};

export type CounterState = {
  count: Signal<number>;
  doubled: Computed<number>;
  isEven: Computed<boolean>;

  // Actions
  increment: () => void;
  decrement: () => void;
  set: (value: number) => void;
};

export const counter =
  (api: SignalsApi) =>
  (options: CounterOptions = {}): CounterState => {
    const { signal, computed } = api;
    const { initialCount = 0 } = options;

    const count = signal(initialCount);
    const doubled = computed(() => count() * 2);
    const isEven = computed(() => count() % 2 === 0);

    return {
      count,
      doubled,
      isEven,

      increment: () => count(count() + 1),
      decrement: () => count(count() - 1),
      set: (value: number) => count(value),
    };
  };
