/**
 * @fileoverview Component implementation using fast-signals
 * 
 * This provides the same API as the original component.ts but uses
 * fast-signals internally for better performance.
 */

import type { ComponentContext, SetState, SignalState } from './types';
import { createSignal, updateSignal } from '../primitives/fast-signals/lattice-adapter';
import { batch } from '../primitives/fast-signals';

/**
 * Helper for creating partial updates with structural sharing
 */
export function partial<T>(key: keyof T, value: T[keyof T]): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Creates a component context with reactive state using fast-signals
 */
export function createComponent<State extends object>(
  initialState: State
): ComponentContext<State> {
  // Create signals for state
  const store = {} as SignalState<State>;
  
  // Create all signals
  for (const [key, value] of Object.entries(initialState)) {
    store[key as keyof State] = createSignal(value) as any;
  }
  
  // Create set function
  const set: SetState = ((target: any, updates: any) => {
    // Use fast-signals batching
    return batch(() => {
      // Batch update to store
      if (target === store) {
        const updateObj = typeof updates === 'function' 
          ? updates(getCurrentState())
          : updates;
          
        for (const [key, value] of Object.entries(updateObj)) {
          if (key in store) {
            updateSignal(store[key as keyof State] as any, value);
          }
        }
        return;
      }
      
      // Single signal update
      if (typeof target === 'function' && target.subscribe) {
        updateSignal(target, updates);
        return;
      }
      
      throw new Error('Invalid set target');
    });
  }) as SetState;
  
  // Helper to get current state
  function getCurrentState(): State {
    const current = {} as State;
    for (const key in store) {
      current[key] = store[key]();
    }
    return current;
  }
  
  // For now, return a minimal context without computed/effect
  return {
    store,
    set,
    // Stub these for now
    signal: () => { throw new Error('Not implemented'); },
    computed: () => { throw new Error('Not implemented'); },
    effect: () => { throw new Error('Not implemented'); },
  } as ComponentContext<State>;
}

// Export with different name to avoid conflicts
export { createComponent as createComponentFast };