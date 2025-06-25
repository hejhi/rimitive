/**
 * @fileoverview Svelte-specific store creation without adapter sync
 * 
 * This provides a way to create Lattice stores that work perfectly with Svelte
 * without the circular dependency issues caused by adapter synchronization.
 */

import type { ReactiveSliceFactory, SignalState, SliceHandle, SetState } from './runtime-types';
import { signal } from './runtime';

/**
 * Creates a Svelte-specific store without adapter sync.
 * This avoids circular dependencies and leverages the fact that signals
 * already implement Svelte's store contract.
 * 
 * @param initialState - The initial state for the store
 * @returns A ReactiveSliceFactory for creating slices with Svelte-compatible signals
 * 
 * @example
 * ```typescript
 * import { createSvelteStore } from '@lattice/core';
 * 
 * const createSlice = createSvelteStore({ count: 0, name: "John" });
 * const counter = createSlice(({ count }) => ({
 *   value: count, // This signal works directly as a Svelte store!
 *   increment: () => count(count() + 1)
 * }));
 * ```
 */
export function createSvelteStore<State extends Record<string, unknown>>(
  initialState: State
): ReactiveSliceFactory<State> {
  // Create signals directly without adapter sync
  const signals = {} as SignalState<State>;
  for (const key in initialState) {
    signals[key] = signal(initialState[key]);
  }
  
  return function createSlice<Computed>(
    computeFn: (state: SignalState<State>, set: SetState<State>) => Computed
  ): SliceHandle<Computed> {
    // Since we're using signals directly without adapters, set updates the signals
    const set: SetState<State> = (updates: Partial<State>) => {
      for (const key in updates) {
        const value = updates[key];
        if (value !== undefined && signals[key]) {
          (signals[key] as any)(value);
        }
      }
    };
    const computed = computeFn(signals, set);
    
    function slice(): Computed;
    function slice<ChildDeps>(childFn: (parent: Computed) => ChildDeps): ChildDeps;
    function slice<ChildDeps>(childFn?: (parent: Computed) => ChildDeps) {
      if (!childFn) {
        return computed;
      }
      return childFn(computed);
    }
    
    return slice as SliceHandle<Computed>;
  };
}