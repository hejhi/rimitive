import {
  useMemo,
  useRef,
  useSyncExternalStore,
  useCallback,
} from 'react';
import { useSignalAPI } from './context';
import type { Signal, Readable, ProducerNode } from '@lattice/signals';
import type { ComputedInterface } from '@lattice/signals/computed';
import type { SignalSetter } from './types';

/**
 * Subscribe to a signal, computed, or selected value and return its current value.
 * The component will re-render when the signal value changes.
 *
 * @example
 * ```tsx
 * const count = signal(0);
 *
 * function Counter() {
 *   const value = useSubscribe(count);
 *   return <div>{value}</div>;
 * }
 * ```
 */
export function useSubscribe<T>(signal: Readable<T> & ProducerNode): T {
  const api = useSignalAPI();

  // Memoize the subscribe function to avoid creating new functions on each render
  const subscribeCallback = useMemo(
    () => (onStoreChange: () => void) => api.subscribe(signal, onStoreChange),
    [signal, api]
  );

  return useSyncExternalStore(
    subscribeCallback,
    () => signal.value,
    () => signal.value // Server snapshot
  );
}

/**
 * Create a signal that is scoped to the component lifecycle.
 * Returns a tuple of [value, setter] similar to useState.
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = useSignal(0);
 *   return (
 *     <button onClick={() => setCount(c => c + 1)}>
 *       Count: {count}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSignal<T>(
  initialValue: T | (() => T)
): [T, SignalSetter<T>] {
  const api = useSignalAPI();
  
  // Use ref to store the signal instance - created only once
  const signalRef = useRef<Signal<T> | null>(null);

  if (signalRef.current === null) {
    // Initialize on first render only
    const value =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;

    signalRef.current = api.signal(value);
  }

  const sig = signalRef.current; // We know it's not null after the check above

  // Stable setter function
  const setter = useCallback<SignalSetter<T>>(
    (value) => {
      if (typeof value === 'function') {
        sig.value = (value as (prev: T) => T)(sig.value);
      } else {
        sig.value = value;
      }
    },
    [sig]
  );

  const value = useSubscribe(sig);
  return [value, setter];
}


/**
 * Subscribe to a signal value using a selector function.
 * Only re-renders when the selected value changes.
 *
 * @example
 * ```tsx
 * function UserName({ userSignal }: { userSignal: Signal<User> }) {
 *   const name = useSelector(userSignal, user => user.name);
 *   return <div>{name}</div>;
 * }
 * ```
 */
export function useSelector<T, R>(
  signal: Signal<T>,
  selector: (value: T) => R
): R {
  const api = useSignalAPI();
  
  // We need to update the selector ref on each render to ensure
  // the computed always uses the latest selector function
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  
  // Create a computed value that applies the selector
  // We use a ref to maintain the same computed instance across renders
  const computedRef = useRef<ComputedInterface<R> | null>(null);
  
  // Only create the computed once, but use selectorRef.current
  // to ensure it always uses the latest selector
  if (computedRef.current === null) {
    computedRef.current = api.computed(() => selectorRef.current(signal.value));
  }

  return useSubscribe(computedRef.current);
}
