/**
 * @fileoverview Minimal store implementation for Lattice
 *
 * Provides a state container with signal-based reactivity and
 * batched updates, built on top of Lattice context primitives.
 */

import type { LatticeContext, SignalState } from '../component/types';
import { createLattice } from '../component/context';

/**
 * Helper for creating partial updates with structural sharing
 */
export function partial<T>(key: keyof T, value: T[keyof T]): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Store instance with state management capabilities
 */
export interface Store<T extends object> {
  /** Signal-based state object */
  state: SignalState<T>;

  /** Update state with automatic batching */
  set: (updates: Partial<T> | ((current: T) => Partial<T>)) => void;

  /** Get the underlying context */
  getContext: () => LatticeContext;

  /** Dispose the store and all its resources */
  dispose: () => void;
}

/**
 * Creates a reactive store with signal-based state management
 *
 * @param initialState - Initial state object
 * @param context - Optional context to use (creates new one if not provided)
 * @returns Store instance with state and update methods
 *
 * @example
 * ```typescript
 * const store = createStore({ count: 0, name: 'Test' });
 *
 * // Read state
 * console.log(store.state.count.value); // 0
 *
 * // Update state (automatically batched)
 * store.set({ count: 1, name: 'Updated' });
 *
 * // Use effects to react to changes
 * const ctx = store.getContext();
 * const unsubscribe = ctx.effect(() => {
 *   console.log('Count is:', store.state.count.value);
 * });
 * ```
 */
export function createStore<T extends object>(
  initialState: T,
  context?: LatticeContext
): Store<T> {
  const ctx = context ?? createLattice();

  // Create signal map from initial state
  const signals = {} as SignalState<T>;
  for (const [key, value] of Object.entries(initialState) as [
    keyof T,
    T[keyof T],
  ][]) {
    signals[key] = ctx.signal(value);
  }

  // Batched update function
  const set = (updates: Partial<T> | ((current: T) => Partial<T>)) => {
    ctx.batch(() => {
      // Get current state from all signals
      const current = {} as T;
      for (const [key, signal] of Object.entries(signals) as [
        keyof T,
        SignalState<T>[keyof T],
      ][]) {
        current[key] = signal.value;
      }

      // Calculate new state
      const newState =
        typeof updates === 'function' ? updates(current) : updates;

      // Update changed signals
      for (const [key, value] of Object.entries(newState) as [
        keyof T,
        T[keyof T],
      ][]) {
        if (key in signals && !Object.is(signals[key].value, value)) {
          signals[key].value = value;
        }
      }
    });
  };

  return {
    state: signals,
    set,
    getContext: () => ctx,
    dispose: () => ctx.dispose(),
  };
}
