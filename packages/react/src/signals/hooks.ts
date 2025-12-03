import { useMemo, useRef, useSyncExternalStore, useCallback } from 'react';
import { useSignalAPI } from './context';
import type { SignalFunction } from '@lattice/signals/signal';
import type { ComputedFunction } from '@lattice/signals/computed';
import type { SignalSetter } from './types';

/**
 * Portable signal type - a readable/writable signal with overloaded call signatures.
 * This matches the common pattern used by headless UI libraries.
 */
export type PortableSignal<T> = {
  (): T;
  (value: T): void;
};

/**
 * Subscribe to a signal, computed, or selected value and return its current value.
 * The component will re-render when the signal value changes.
 *
 * Accepts any readable signal-like value (anything callable that returns T).
 * This enables interoperability with portable headless components that define
 * their own signal types (e.g., `{ (): T; (value: T): void }`).
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
// Overload for Lattice SignalFunction
export function useSubscribe<T>(signal: SignalFunction<T>): T;
// Overload for Lattice ComputedFunction
export function useSubscribe<T>(signal: ComputedFunction<T>): T;
// Overload for portable signal type (headless components)
export function useSubscribe<T>(signal: PortableSignal<T>): T;
// Overload for simple readable
export function useSubscribe<T>(signal: () => T): T;
// Implementation
export function useSubscribe<T>(signal: () => T): T {
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

/**
 * Create a component instance that is scoped to the component lifecycle.
 * Components are plain functions that accept a SignalAPI and return behavior.
 *
 * This enables the "component pattern" - building reusable, framework-agnostic
 * UI behaviors that can be shared across React, Vue, Svelte, etc.
 *
 * @example
 * ```tsx
 * // Define a component once
 * function createCounter(api: SignalAPI) {
 *   const count = api.signal(0);
 *   return {
 *     count: () => count(),
 *     increment: () => count(count() + 1),
 *   };
 * }
 *
 * // Use in React
 * function StepCounter() {
 *   const counter = useComponent(createCounter);
 *   const count = useSubscribe(counter.count);
 *   return <button onClick={counter.increment}>Step {count}</button>;
 * }
 *
 * // Use in Vue
 * const counter = useComponent(createCounter);
 * const count = ref(counter.count());
 *
 * // Same component, different frameworks!
 * ```
 *
 * @example
 * ```tsx
 * // Component with initialization arguments
 * function createTodoList(api: SignalAPI, initialTodos: Todo[]) {
 *   const todos = api.signal(initialTodos);
 *   return {
 *     todos: () => todos(),
 *     addTodo: (text: string) => todos([...todos(), { text, done: false }]),
 *   };
 * }
 *
 * function TodoApp() {
 *   const todoList = useComponent(createTodoList, [
 *     { text: 'Learn Lattice', done: false }
 *   ]);
 *   const todos = useSubscribe(todoList.todos);
 *   return <div>{todos.length} todos</div>;
 * }
 * ```
 */
export function useComponent<T, Args extends unknown[]>(
  factory: (api: ReturnType<typeof useSignalAPI>, ...args: Args) => T,
  ...args: Args
): T {
  const api = useSignalAPI();

  // Create component instance once on mount
  const componentRef = useRef<T | null>(null);

  if (componentRef.current === null) {
    componentRef.current = factory(api, ...args);
  }

  return componentRef.current;
}

/**
 * Portable readable signal type - can be read by calling with no args.
 */
export interface Readable<T> {
  (): T;
}

/**
 * Portable writable signal type - can be read or written.
 */
export interface Writable<T> extends Readable<T> {
  (value: T): void;
}

/**
 * Reactive adapter interface for portable headless components.
 * This is compatible with Lattice's SignalAPI and other reactive systems.
 */
export interface ReactiveAdapter {
  signal: <T>(initialValue: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
}

/**
 * Create a React hook from a double-function behavior pattern.
 *
 * This is designed for portable headless components that follow the pattern:
 * `(api) => (...args) => Result`
 *
 * The returned hook handles SignalAPI injection automatically and creates
 * one instance per React component (like useComponent).
 *
 * @example
 * ```tsx
 * // Import a portable headless behavior
 * import { useDialog } from '@my-design-system/headless';
 *
 * // Create a React hook from it (typically at module level)
 * const useDialogHook = createHook(useDialog);
 *
 * // Use in React components - clean, familiar API
 * function MyModal() {
 *   const dialog = useDialogHook({ initialOpen: false });
 *   const isOpen = useSubscribe(dialog.isOpen);
 *
 *   return (
 *     <>
 *       <button onClick={dialog.open}>Open</button>
 *       {isOpen && <div>Modal content</div>}
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Works with behaviors that take no arguments
 * const useCounterHook = createHook(useCounter);
 * const counter = useCounterHook(); // No args required!
 *
 * // Works with optional arguments
 * const useDialogHook = createHook(useDialog);
 * const dialog = useDialogHook(); // Optional args
 * const dialog2 = useDialogHook({ initialOpen: true });
 *
 * // Works with required arguments
 * const useSelectHook = createHook(useSelect);
 * const select = useSelectHook({ options: myOptions }); // Required args
 * ```
 *
 * Note: Arguments are captured once when the component mounts (like useRef's
 * initial value). If you need reactive options, pass signals as option values
 * and read them inside the behavior.
 */
export function createHook<Api extends ReactiveAdapter, Args extends unknown[], Result>(
  behavior: (api: Api) => (...args: Args) => Result
): (...args: Args) => Result {
  return function useHook(...args: Args): Result {
    const api = useSignalAPI();

    // Create behavior instance once on mount
    const instanceRef = useRef<Result | null>(null);

    if (instanceRef.current === null) {
      // Cast is safe because SignalAPI satisfies ReactiveAdapter
      instanceRef.current = behavior(api as unknown as Api)(...args);
    }

    return instanceRef.current;
  };
}
