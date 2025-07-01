/**
 * @fileoverview React hooks for Lattice behavioral components
 *
 * Provides idiomatic React integration for Lattice's signal-based component system.
 * Supports both component-scoped and shared/global behavior patterns with fine-grained reactivity.
 */

import {
  useSyncExternalStore,
  useCallback,
  useMemo,
} from 'react';
import { createComponent, type Signal, type Computed, type ComponentFactory } from '@lattice/core';

/**
 * React hook for creating component-scoped Lattice behavioral components.
 * 
 * This hook creates a new component instance with its own state that is scoped
 * to the React component's lifecycle. Perfect for UI components that need
 * isolated state management.
 *
 * @param initialState - The initial state for the component
 * @param factory - A component factory function that defines behavior
 * @returns The component instance with all behaviors and reactive state
 *
 * @example
 * ```tsx
 * import { useComponent, useSignal } from '@lattice/frameworks/react';
 * 
 * // Define component behavior
 * const Dialog = ({ store, computed, set }) => ({
 *   isOpen: store.isOpen,
 *   title: store.title,
 *   
 *   triggerProps: computed(() => ({
 *     'aria-haspopup': 'dialog',
 *     'aria-expanded': store.isOpen(),
 *     onClick: () => set(store.isOpen, true),
 *   })),
 *   
 *   open: () => set(store.isOpen, true),
 *   close: () => set(store.isOpen, false),
 * });
 * 
 * // Use in React component with component-scoped state
 * function MyDialog() {
 *   const dialog = useComponent(
 *     { isOpen: false, title: 'Welcome' },
 *     Dialog
 *   );
 *   const isOpen = useSignal(dialog.isOpen);
 *   
 *   return (
 *     <>
 *       <button {...dialog.triggerProps()}>Open Dialog</button>
 *       {isOpen && (
 *         <div role="dialog">
 *           <h2>{dialog.title()}</h2>
 *           <button onClick={dialog.close}>Close</button>
 *         </div>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useComponent<State extends Record<string, any>, Component>(
  initialState: State,
  factory: ComponentFactory<State>
): Component {
  // Create component context and instance, memoized for lifecycle
  const component = useMemo(() => {
    const context = createComponent(initialState);
    return factory(context);
  }, []); // Empty deps - we want this to be created once per component instance

  return component;
}

/**
 * React hook that subscribes to a signal and returns its current value.
 * Re-renders the component only when this specific signal changes.
 *
 * This is the key to Lattice's fine-grained reactivity in React.
 * Only subscribe to the signals you actually use in your render.
 *
 * @param signal - A signal or computed value
 * @returns The current value of the signal
 *
 * @example
 * ```tsx
 * import { useSignal } from '@lattice/frameworks/react';
 * 
 * function UserProfile({ userStore }) {
 *   // Only re-renders when the name changes
 *   const name = useSignal(userStore.name);
 *   
 *   // Does NOT re-render when email changes
 *   return <h1>Welcome, {name}!</h1>;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Using with shared/global state
 * const authContext = createComponent({ user: null });
 * const auth = Auth(authContext);
 * 
 * function NavBar() {
 *   const user = useSignal(auth.user);
 *   return user ? <div>Welcome {user.name}</div> : <Login />;
 * }
 * ```
 */
export function useSignal<T>(signal: Signal<T> | Computed<T>): T {
  return useSyncExternalStore(
    useCallback((onStoreChange) => signal.subscribe(onStoreChange), [signal]),
    useCallback(() => signal(), [signal]),
    useCallback(() => signal(), [signal])
  );
}

/**
 * React hook for creating derived state from signals.
 * 
 * This is useful for creating computed values that depend on multiple signals
 * or for transforming signal values for display. The component will only
 * re-render when one of the dependent signals changes.
 *
 * @param compute - A function that computes a value from signals
 * @param deps - Signal dependencies to track
 * @returns The computed value, updated when dependencies change
 *
 * @example
 * ```tsx
 * function Cart({ cartStore }) {
 *   const totalPrice = useComputed(
 *     () => {
 *       const items = cartStore.items();
 *       const taxRate = cartStore.taxRate();
 *       const subtotal = items.reduce((sum, item) => sum + item.price, 0);
 *       return subtotal * (1 + taxRate);
 *     },
 *     [cartStore.items, cartStore.taxRate]
 *   );
 *   
 *   return <div>Total: ${totalPrice.toFixed(2)}</div>;
 * }
 * ```
 */
export function useComputed<T>(
  compute: () => T,
  deps: (Signal<any> | Computed<any>)[]
): T {
  // Create a stable subscribe function that doesn't change unless deps change
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => {
      const unsubscribers = deps.map(dep => dep.subscribe(onStoreChange));
      return () => unsubscribers.forEach(unsub => unsub());
    },
    deps
  );
  
  return useSyncExternalStore(subscribe, compute, compute);
}