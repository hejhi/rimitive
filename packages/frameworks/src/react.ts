/**
 * @fileoverview React hooks for Lattice signals-first API
 *
 * Provides minimal, idiomatic React integration for Lattice headless components.
 * Signals work directly as reactive values in React components.
 */

import {
  useSyncExternalStore,
  useCallback,
  useState,
  useEffect,
} from 'react';
import type { Signal, Computed } from '@lattice/core';

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(value: unknown): value is Signal<unknown> | Computed<unknown> {
  return typeof value === 'function' && 
         value !== null &&
         'subscribe' in value &&
         typeof value.subscribe === 'function';
}

/**
 * React hook that subscribes to a signal and returns its current value.
 * Re-renders the component when the signal changes.
 *
 * @param signal - A signal or computed value
 * @returns The current value of the signal
 *
 * @example
 * ```tsx
 * function CountDisplay() {
 *   const counter = useStore(counterStore);
 *   const count = useSignal(counter.value);
 *   return <div>Count: {count}</div>;
 * }
 * ```
 */
export function useSignal<T>(signal: Signal<T> | Computed<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => signal.subscribe(onStoreChange),
    [signal]
  );
  
  const getSnapshot = useCallback(() => signal(), [signal]);
  const getServerSnapshot = getSnapshot;
  
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * React hook for using Lattice stores.
 * Returns the store object with all signals and actions.
 * Does NOT automatically subscribe to signals - use useSignal for that.
 *
 * @param store - A Lattice store
 * @returns The store object with signals and actions
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const counter = useStore(counterStore);
 *   const count = useSignal(counter.value);
 *   return (
 *     <button onClick={counter.increment}>
 *       Count: {count}
 *     </button>
 *   );
 * }
 * ```
 */
export function useStore<T>(store: T): T {
  // For now, just return the store as-is
  // The user needs to use useSignal to subscribe to individual signals
  return store;
}

/**
 * React hook that automatically subscribes to all signals in a store.
 * Re-renders when any signal in the store changes.
 *
 * @param store - A Lattice store
 * @returns The store object
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const counter = useAutoStore(counterStore);
 *   return (
 *     <button onClick={counter.increment}>
 *       Count: {counter.value()}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAutoStore<T extends Record<string, any>>(store: T): T {
  // Create a version counter to force React updates
  const [version, setVersion] = useState(0);
  
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    // Subscribe to all signals
    for (const key in store) {
      const value = store[key];
      if (isSignal(value)) {
        const signal = value as Signal<unknown> | Computed<unknown>;
        const unsubscribe = signal.subscribe(() => {
          setVersion(v => v + 1);
        });
        unsubscribers.push(unsubscribe);
      }
    }
    
    // Also subscribe to store changes if available
    if (store !== null && 
        typeof store === 'object' && 
        '_subscribe' in store && 
        typeof store._subscribe === 'function') {
      const unsubscribe = store._subscribe(() => {
        setVersion(v => v + 1);
      });
      unsubscribers.push(unsubscribe);
    }
    
    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [store]);
  
  // Force re-render when version changes
  version;
  
  return store;
}