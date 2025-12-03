/**
 * useCounter - Portable Counter Behavior
 *
 * A simple counter with derived values for doubled and isEven.
 * Framework-agnostic - works with any signals implementation.
 *
 * @example
 * ```ts
 * // With Lattice signals
 * const counter = useCounter({ signal, computed, effect })();
 *
 * // With React (via createHook)
 * const useCounterHook = createHook(useCounter);
 * const counter = useCounterHook();
 * ```
 */
import type { SignalsApi, Signal, Computed } from './types';

export interface UseCounterOptions {
  /** Initial count value */
  initialCount?: number;
}

export interface CounterState {
  /** Current count value */
  count: Signal<number>;
  /** Count multiplied by 2 */
  doubled: Computed<number>;
  /** Whether count is even */
  isEven: Computed<boolean>;

  /** Increment count by 1 */
  increment: () => void;
  /** Decrement count by 1 */
  decrement: () => void;
  /** Set count to a specific value */
  set: (value: number) => void;
}

/**
 * Creates a portable counter behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates counter state
 */
export const useCounter =
  (api: SignalsApi) =>
  (options: UseCounterOptions = {}): CounterState => {
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
