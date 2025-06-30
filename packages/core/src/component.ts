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
} from './runtime-types';
import { createLatticeContext } from './lattice-context';
import { type StoreAdapter } from './adapter-contract';
import {
  updateSignalValue,
  isDerivedSignal,
  getSourceSignal,
  type DerivedSignal,
} from './signal';



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
  adapter: StoreAdapter<State>
): ComponentContext<State> {

  // Create scoped lattice context
  const lattice = createLatticeContext();

  // Create read-only signals that mirror adapter state
  const state = adapter.getState();
  const stateSignals = {} as SignalState<State>;

  // Create internal signals map - these are writable
  type StateKey = Extract<keyof State, string>;
  const internalSignals = new Map<StateKey, Signal<State[StateKey]>>();

  // Helper to create a read-only signal wrapper for a specific key
  function createReadOnlySignal<K extends StateKey>(
    internalSig: Signal<State[K]>
  ): Signal<State[K]> {
    // Create read-only wrapper that tracks dependencies and forwards all operations
    const wrapper = ((...args: any[]) => {
      // Forward all arguments to the internal signal
      return (internalSig as any)(...args);
    }) as Signal<State[K]>;
    wrapper.subscribe = internalSig.subscribe;
    return wrapper;
  }

  // Initialize signals for all state keys
  (Object.keys(state) as StateKey[]).forEach((key) => {
    const internalSig = lattice.signal(state[key]);
    internalSignals.set(key, internalSig);
    stateSignals[key] = createReadOnlySignal(internalSig);
  });

  // Subscribe to adapter changes
  adapter.subscribe(() => {
    lattice._batch(() => {
      const newState = adapter.getState();

      // Update signals with new state
      (Object.keys(newState) as StateKey[]).forEach((key) => {
        const newVal = newState[key];
        const existingSig = internalSignals.get(key);

        if (existingSig) {
          if (!Object.is(existingSig(), newVal)) {
            // Update the internal writable signal
            updateSignalValue(existingSig, newVal, lattice._batching);
          }
        } else {
          // Create new signal for new key
          const internalSig = lattice.signal(newVal);
          internalSignals.set(key, internalSig);
          stateSignals[key] = createReadOnlySignal(internalSig);
        }
      });
    });
  })


  // Create set function that delegates to adapter
  const set: SetState = ((signal: Signal<any>, updates: any) => {
    // For adapter stores, we need to update through the adapter
    // Find which state key this signal belongs to
    let stateKey: string | undefined;
    for (const key in stateSignals) {
      if (stateSignals[key] === signal) {
        stateKey = key;
        break;
      }
      // Check if it's a derived signal from this state key
      if (isDerivedSignal(signal)) {
        const source = getSourceSignal(signal);
        if (source === stateSignals[key]) {
          stateKey = key;
          break;
        }
        // Also check if source is a wrapper pointing to the same internal signal
        const internalSig = internalSignals.get(key as StateKey);
        if (internalSig && source === internalSig) {
          stateKey = key;
          break;
        }
      }
    }

    if (!stateKey) {
      throw new Error('Signal not found in store');
    }

    // Handle derived signals specially
    if (isDerivedSignal(signal)) {
      const derivedSig = signal as DerivedSignal<any, any>;
      const sourceSignal = stateSignals[stateKey as keyof State];
      const sourceValue = sourceSignal();
      
      // Ensure the derived signal has been evaluated to find its target
      const currentDerivedValue = signal();
      if (currentDerivedValue === undefined) {
        // Item not found, nothing to update
        return;
      }
      
      // For arrays, update the specific item
      if (Array.isArray(sourceValue) && derivedSig._cachedIndex !== undefined) {
        const newArray = [...sourceValue];
        const currentItem = newArray[derivedSig._cachedIndex as number];
        
        if (currentItem !== undefined) {
          let newItem: any;
          if (typeof updates === 'function') {
            newItem = updates(currentItem);
          } else if (
            typeof updates === 'object' &&
            updates !== null &&
            typeof currentItem === 'object' &&
            currentItem !== null &&
            !Array.isArray(currentItem)
          ) {
            // Partial update for objects
            newItem = { ...currentItem, ...updates };
          } else {
            newItem = updates;
          }
          
          newArray[derivedSig._cachedIndex as number] = newItem;
          adapter.setState({ [stateKey]: newArray } as Partial<State>);
          return;
        }
      }
      
      // For other collection types, fall through to regular handling
      // This would need similar special handling for Maps, Sets, etc.
    }
    
    // Regular signal update
    const currentValue = signal();

    let newValue: any;
    if (typeof updates === 'function') {
      newValue = updates(currentValue);
    } else if (
      typeof updates === 'object' &&
      updates !== null &&
      typeof currentValue === 'object' &&
      currentValue !== null &&
      !Array.isArray(currentValue) &&
      !(currentValue instanceof Set) &&
      !(currentValue instanceof Map)
    ) {
      // Partial update for objects
      newValue = { ...currentValue, ...updates };
    } else {
      newValue = updates;
    }

    // Update through adapter
    adapter.setState({ [stateKey]: newValue } as Partial<State>);
  }) as SetState;

  // Create component context with merged functionality
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };
  
  return context;
}
