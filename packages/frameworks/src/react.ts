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
  useRef,
} from 'react';
import type { SliceHandle, Signal, Computed } from '@lattice/core';

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(value: unknown): value is Signal<unknown> | Computed<unknown> {
  return typeof value === 'function' && 
         typeof (value as any).subscribe === 'function';
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
 *   const slice = counterSlice();
 *   const count = useSignal(slice.value);
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
 * React hook for using Lattice slices.
 * Subscribes to all signals in the slice and triggers re-renders when any change.
 *
 * @param slice - A reactive slice handle
 * @returns The computed object with signals and actions
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const counter = useSlice(counterSlice);
 *   return (
 *     <button onClick={counter.increment}>
 *       Count: {counter.value()}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSlice<Computed>(
  slice: SliceHandle<Computed>
): Computed {
  const [, forceUpdate] = useState(0);
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const isInitialized = useRef(false);
  
  // Get fresh slice object on each render
  const sliceObject = slice();
  
  useEffect(() => {
    // Only set up subscriptions once
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    // Find all signals in the slice and subscribe to them
    const newUnsubscribers: (() => void)[] = [];
    
    for (const key in sliceObject) {
      const value = sliceObject[key as keyof Computed];
      if (isSignal(value)) {
        const unsubscribe = value.subscribe(() => {
          // Force a re-render when any signal changes
          forceUpdate(prev => prev + 1);
        });
        newUnsubscribers.push(unsubscribe);
      }
    }
    
    unsubscribersRef.current = newUnsubscribers;
    
    // Cleanup on unmount
    return () => {
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];
      isInitialized.current = false;
    };
  }, []);
  
  return sliceObject;
}