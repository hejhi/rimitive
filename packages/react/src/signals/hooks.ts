import {
  useMemo,
  useRef,
  useSyncExternalStore,
  useCallback,
} from 'react';
import { signal } from '@lattice/signals';
import type { Signal, Selected } from '@lattice/signals';
import type { SignalLike, SignalSetter } from './types';

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
export function useSubscribe<T>(signal: SignalLike<T>): T {
  // Memoize the subscribe function to avoid creating new functions on each render
  const subscribe = useMemo(
    () => signal.subscribe.bind(signal),
    [signal]
  );
  
  return useSyncExternalStore(
    subscribe,
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
  // Use ref to store the signal instance - created only once
  const signalRef = useRef<Signal<T> | null>(null);

  if (signalRef.current === null) {
    // Initialize on first render only
    const value =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;

    signalRef.current = signal(value);
  }

  const sig = signalRef.current;

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
  // Store selector in ref to detect changes
  const selectorRef = useRef(selector);
  const selectedRef = useRef<Selected<R> | null>(null);
  
  // Only recreate selected if signal or selector changes
  if (selectedRef.current === null || selectorRef.current !== selector) {
    selectorRef.current = selector;
    selectedRef.current = signal.select(selector);
  }

  return useSubscribe(selectedRef.current);
}
