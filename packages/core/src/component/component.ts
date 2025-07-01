/**
 * @fileoverview Component-scoped Lattice implementation
 *
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type {
  ComponentContext,
  SetState,
  SignalState,
  Signal,
  ComponentMiddleware,
} from './types';
import { createLatticeContext } from './context';
import { type StoreAdapter } from '../adapters/contract';
import { updateSignalValue, isDerivedSignal } from '../core/signal';
import {
  applyUpdate,
  handleDerivedSignalUpdate,
  findSignalStateKey,
} from './state-updates';

/**
 * Helper for creating partial updates with structural sharing
 * Re-exported from runtime for convenience
 */
export function partial<T extends Record<string, any>>(
  key: keyof T,
  value: any
): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Creates a component context from a store adapter
 */
export function createComponent<State extends Record<string, any>>(
  adapter: StoreAdapter<State>,
  enhancer?: ComponentMiddleware<State>
): ComponentContext<State> {
  // Create scoped lattice context
  const lattice = createLatticeContext();

  // Create signals that mirror adapter state
  const state = adapter.getState();
  const stateSignals = {} as SignalState<State>;

  // Create a WeakMap to store signal -> key mappings for O(1) lookup
  const signalToKeyMap = new WeakMap<Signal<any>, keyof State>();

  // Initialize signals for all state keys
  type StateKey = Extract<keyof State, string>;

  (Object.keys(state) as StateKey[]).forEach((key) => {
    stateSignals[key] = lattice.signal(state[key]);
    // Add to map for O(1) lookup
    signalToKeyMap.set(stateSignals[key], key);
  });

  // Subscribe to adapter changes
  adapter.subscribe(() => {
    lattice._batch(() => {
      const newState = adapter.getState();

      // Check if adapter supports tracking changed keys
      const changedKeys = (adapter as any)._getLastChangedKeys?.() as StateKey[] | undefined;
      
      if (changedKeys && changedKeys.length > 0) {
        // Optimized path: only update changed keys
        changedKeys.forEach((key) => {
          const newVal = newState[key];
          const existingSig = stateSignals[key];

          if (existingSig) {
            if (!Object.is(existingSig(), newVal)) {
              // Update the signal value and notify listeners
              updateSignalValue(existingSig, newVal, lattice._batching);
            }
          } else {
            // Create new signal for new key
            stateSignals[key] = lattice.signal(newVal);
            signalToKeyMap.set(stateSignals[key], key);
          }
        });
      } else {
        // Fallback: check all keys (for adapters that don't track changes)
        (Object.keys(newState) as StateKey[]).forEach((key) => {
          const newVal = newState[key];
          const existingSig = stateSignals[key];

          if (existingSig) {
            if (!Object.is(existingSig(), newVal)) {
              // Update the signal value and notify listeners
              updateSignalValue(existingSig, newVal, lattice._batching);
            }
            return;
          }

          // Create new signal for new key
          stateSignals[key] = lattice.signal(newVal);
          signalToKeyMap.set(stateSignals[key], key);
        });
      }
    });
  });

  // Create set function that writes directly to signals
  const set: SetState = (target: Signal<any> | SignalState<State>, updates: any) => {
    // Check if it's a batch update on the store
    if (target === stateSignals) {
      // Batch update - update multiple signals at once
      lattice._batch(() => {
        // Get current state from all signals
        const currentState = {} as State;
        (Object.keys(stateSignals) as (keyof State)[]).forEach(key => {
          currentState[key] = stateSignals[key]();
        });
        
        // Calculate new state
        const newState = typeof updates === 'function' ? updates(currentState) : updates;
        
        // Update each changed signal
        (Object.entries(newState) as [keyof State, any][]).forEach(([key, value]) => {
          if (key in stateSignals && !Object.is(stateSignals[key](), value)) {
            updateSignalValue(stateSignals[key], value, lattice._batching);
          }
        });
      });
      return;
    }

    // Single signal update
    const signal = target as Signal<any>;
    
    // Handle derived signals specially
    if (isDerivedSignal(signal)) {
      let stateKey = signalToKeyMap.get(signal);
      if (!stateKey) {
        const foundKey = findSignalStateKey(signal, stateSignals);
        if (!foundKey) throw new Error('Signal not found in store');
        stateKey = foundKey;
      }
      
      const sourceSignal = stateSignals[stateKey as keyof State];
      const sourceValue = sourceSignal();
      const result = handleDerivedSignalUpdate(signal, sourceValue, updates);

      if (result) {
        updateSignalValue(sourceSignal, result.value, lattice._batching);
        return;
      }
    }

    // Regular signal update
    const newValue = applyUpdate(signal(), updates);
    updateSignalValue(signal, newValue, lattice._batching);
  };

  // Create component context with merged functionality
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };

  return enhancer ? enhancer(context) : context;
}
