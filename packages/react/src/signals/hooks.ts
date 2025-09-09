import {
  useMemo,
  useRef,
  useSyncExternalStore,
  useCallback,
} from 'react';
import { useSignalAPI } from './context';
import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';
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
export function useSubscribe<T>(signal: SignalFunction<T> | ComputedFunction<T>): T {
  const api = useSignalAPI();

  // Create stable subscription using effect
  const subscribeCallback = useMemo(
    () => (onStoreChange: () => void) => {
      let isFirstRun = true;
      // Subscribe using an effect that reads the signal
      const dispose = api.effect(() => {
        signal(); // Read the signal to track it
        // Don't notify on the initial effect run
        if (!isFirstRun) {
          onStoreChange(); // Notify React when it changes
        }
        isFirstRun = false;
      });
      return dispose;
    },
    [signal, api]
  );

  return useSyncExternalStore(
    subscribeCallback,
    () => signal(), // Read current value
    () => signal() // Server snapshot
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
  const signalRef = useRef<SignalFunction<T> | null>(null);

  if (signalRef.current === null) {
    // Initialize on first render only
    const value =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;

    signalRef.current = api.signal(value);
  }

  const sig = signalRef.current; // Created on first render

  // Stable setter function
  const setter = useCallback<SignalSetter<T>>(
    (value) => {
      if (typeof value === 'function') {
        sig((value as (prev: T) => T)(sig()));
      } else {
        sig(value);
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
  signal: SignalFunction<T>,
  selector: (value: T) => R
): R {
  const api = useSignalAPI();
  
  // We need to update the selector ref on each render to ensure
  // the computed always uses the latest selector function
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  
  // Create a computed value that applies the selector
  // We use a ref to maintain the same computed instance across renders
  const computedRef = useRef<ComputedFunction<R> | null>(null);
  
  // Only create the computed once, but use selectorRef.current
  // to ensure it always uses the latest selector
  if (computedRef.current === null) {
    computedRef.current = api.computed(() => selectorRef.current(signal()));
  }

  return useSubscribe(computedRef.current);
}
