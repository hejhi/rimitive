import { useMemo, useRef, useSyncExternalStore, useCallback } from 'react';
import { useSignalSvc } from './context';
import type { SignalSetter } from './types';
import type { Reactive, Readable, Writable } from '@rimitive/signals/types';

/**
 * Subscribe to a signal value in React.
 * Re-renders the component when the signal changes.
 *
 * @example
 * ```tsx
 * function Counter({ count }: { count: Readable<number> }) {
 *   const value = useSubscribe(count);
 *   return <span>{value}</span>;
 * }
 * ```
 */
export function useSubscribe<T>(signal: Reactive<T>): T {
  const svc = useSignalSvc();

  // Create stable subscription using effect
  const subscribeCallback = useMemo(
    () => (onStoreChange: () => void) => {
      let isFirstRun = true;
      // Subscribe using an effect that reads the signal
      const dispose = svc.effect(() => {
        signal(); // Read the signal to track it
        // Don't notify on the initial effect run
        if (!isFirstRun) {
          onStoreChange(); // Notify React when it changes
        }
        isFirstRun = false;
      });
      return dispose;
    },
    [signal, svc]
  );

  return useSyncExternalStore(
    subscribeCallback,
    signal, // Read current value
    signal // Server snapshot
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
 *     <button onClick={() => setCount(count + 1)}>
 *       Count: {count}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With updater function
 * function Counter() {
 *   const [count, setCount] = useSignal(0);
 *   return (
 *     <button onClick={() => setCount(prev => prev + 1)}>
 *       Count: {count}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSignal<T>(
  initialValue: T | (() => T)
): [T, SignalSetter<T>] {
  const svc = useSignalSvc();

  // Use ref to store the signal instance - created only once
  const signalRef = useRef<Reactive<T> | null>(null);

  if (signalRef.current === null) {
    // Initialize on first render only
    const value =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;

    signalRef.current = svc.signal(value);
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
 * function UserName({ user }: { user: Readable<User> }) {
 *   const name = useSelector(user, u => u.name);
 *   return <span>{name}</span>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Avoid unnecessary re-renders when deeply nested properties change
 * function TodoCount({ todos }: { todos: Readable<Todo[]> }) {
 *   const count = useSelector(todos, list => list.length);
 *   return <div>Total: {count}</div>;
 * }
 * ```
 */
export function useSelector<T, R>(
  signal: Reactive<T>,
  selector: (value: T) => R
): R {
  const svc = useSignalSvc();

  // We need to update the selector ref on each render to ensure
  // the computed always uses the latest selector function
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Create a computed value that applies the selector
  // We use a ref to maintain the same computed instance across renders
  const computedRef = useRef<Reactive<R> | null>(null);

  // Only create the computed once, but use selectorRef.current
  // to ensure it always uses the latest selector
  if (computedRef.current === null) {
    computedRef.current = svc.computed(() => selectorRef.current(signal()));
  }

  return useSubscribe(computedRef.current);
}

/**
 * Minimal constraint for reactive services used with createHook.
 * Behaviors can require more specific services - this is just the floor.
 */
type ReactiveSvc = {
  signal: <T>(initialValue: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};

/**
 * Create a React hook from a double-function behavior pattern.
 *
 * This is designed for portable headless components that follow the pattern:
 * `(svc) => (...args) => Result`
 *
 * The returned hook handles svc injection automatically and creates a memoized behavior instance.
 *
 * Note: Arguments are captured once when the component mounts (like useRef's
 * initial value). If you need reactive options, pass signals as option values
 * and read them inside the behavior.
 *
 * @example
 * ```tsx
 * // Define a portable behavior
 * const useCounter = createHook((svc) => (initialValue: number) => {
 *   const count = svc.signal(initialValue);
 *   const increment = () => count(count() + 1);
 *   return { count, increment };
 * });
 *
 * // Use it in a component
 * function Counter() {
 *   const { count, increment } = useCounter(0);
 *   const value = useSubscribe(count);
 *   return <button onClick={increment}>Count: {value}</button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With reactive options via signals
 * const useTimer = createHook((svc) => (interval: Readable<number>) => {
 *   const elapsed = svc.signal(0);
 *   svc.effect(() => {
 *     const timer = setInterval(() => {
 *       elapsed(elapsed() + 1);
 *     }, interval());
 *     return () => clearInterval(timer);
 *   });
 *   return elapsed;
 * });
 * ```
 */
export function createHook<
  TSvc extends ReactiveSvc,
  Args extends unknown[],
  Result,
>(
  behavior: (svc: TSvc) => (...args: Args) => Result
): (...args: Args) => Result {
  return function useHook(...args: Args): Result {
    const svc = useSignalSvc();

    // Create behavior instance once on mount
    const instanceRef = useRef<Result | null>(null);

    if (instanceRef.current === null) {
      instanceRef.current = behavior(svc as unknown as TSvc)(...args);
    }

    return instanceRef.current;
  };
}
