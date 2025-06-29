/**
 * @fileoverview Component-scoped Lattice implementation
 *
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type {
  ComponentFactory,
  ComponentContext,
  SetState,
  SignalState,
  Signal,
} from './runtime-types';
import { createLatticeContext } from './lattice-context';
import { type StoreAdapter } from './adapter-contract';
import type { FromMarker } from './component-types';
import { updateSignalValue, isDerivedSignal, getSourceSignal } from './signal';

/**
 * Creates a state marker with optional initializer
 */
export function withState<State extends Record<string, any>>(
  initializer: () => State
): FromMarker<State>;

export function withState<
  State extends Record<string, any>,
>(): FromMarker<State>;

export function withState<State extends Record<string, any>>(
  initializer?: () => State
): FromMarker<State> {
  if (initializer) {
    const initial = initializer();
    return {
      _state: initial,
      _initial: initial,
      _middleware: [],
    };
  } else {
    return {
      _state: {} as State,
      _initial: {} as State,
      _middleware: [],
    };
  }
}

/**
 * Creates a component factory from a state marker and factory function
 */
export function createComponent<Marker extends FromMarker<any>, Slices>(
  marker: Marker,
  factory: (ctx: ComponentContext<Marker['_state']>) => Slices
): ComponentFactory<Marker['_state'], Slices> {
  type State = Marker['_state'];
  const middleware = marker._middleware;

  // Return wrapped factory that applies middleware
  return (context: ComponentContext<State>) => {
    // Apply middleware in order
    const enhancedContext = middleware.reduce((ctx, mw) => mw(ctx), context);
    return factory(enhancedContext);
  };
}

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
 * Creates a store from a component factory and initial state
 */
export function createStore<State extends Record<string, any>, Slices>(
  component: ComponentFactory<State, Slices>,
  initialState: State
): Slices & {
  _getState: () => State;
  _subscribe: (fn: () => void) => () => void;
} {
  // Create internal state management
  let state = { ...initialState };
  const listeners = new Set<() => void>();


  // Create scoped lattice context
  const lattice = createLatticeContext<State>();

  // Create state signals
  const stateSignals = {} as SignalState<State>;
  for (const key in state) {
    stateSignals[key] = lattice.signal(state[key]);
  }

  // Create set function that updates signals
  const set: SetState<State> = ((signal: Signal<any>, updates: any) => {
    lattice._batch(() => {
      // Handle derived signals - update through source
      if (isDerivedSignal(signal)) {
        const source = getSourceSignal(signal);
        if (!source) return;
        
        const currentValue = signal();
        if (currentValue === undefined) return;
        
        // Get the source collection
        const sourceValue = source();
        
        // Find and update in source collection
        if (Array.isArray(sourceValue)) {
          // Use cached index if available
          const cachedIndex = (signal as any)._cachedIndex;
          if (cachedIndex !== undefined && sourceValue[cachedIndex] === currentValue) {
            // O(1) update using cached position
            const newArray = [...sourceValue];
            if (typeof updates === 'function') {
              newArray[cachedIndex] = updates(currentValue);
            } else if (typeof currentValue === 'object' && currentValue !== null) {
              newArray[cachedIndex] = { ...currentValue, ...updates };
            } else {
              newArray[cachedIndex] = updates;
            }
            updateSignalValue(source, newArray, lattice._batching);
          } else {
            // Fallback to O(n) search
            const index = sourceValue.indexOf(currentValue);
            if (index !== -1) {
              const newArray = [...sourceValue];
              if (typeof updates === 'function') {
                newArray[index] = updates(currentValue);
              } else if (typeof currentValue === 'object' && currentValue !== null) {
                newArray[index] = { ...currentValue, ...updates };
              } else {
                newArray[index] = updates;
              }
              updateSignalValue(source, newArray, lattice._batching);
            }
          }
        } else if (sourceValue instanceof Map) {
          const cachedKey = (signal as any)._cachedIndex;
          if (cachedKey !== undefined && sourceValue.get(cachedKey) === currentValue) {
            // O(1) update using cached key
            const newMap = new Map(sourceValue);
            if (typeof updates === 'function') {
              newMap.set(cachedKey, updates(currentValue));
            } else if (typeof currentValue === 'object' && currentValue !== null) {
              newMap.set(cachedKey, { ...currentValue, ...updates });
            } else {
              newMap.set(cachedKey, updates);
            }
            updateSignalValue(source, newMap, lattice._batching);
          }
        } else if (sourceValue instanceof Set) {
          // Sets need special handling - remove old, add new
          const newSet = new Set(sourceValue);
          newSet.delete(currentValue);
          if (typeof updates === 'function') {
            newSet.add(updates(currentValue));
          } else if (typeof currentValue === 'object' && currentValue !== null) {
            newSet.add({ ...currentValue, ...updates });
          } else {
            newSet.add(updates);
          }
          updateSignalValue(source, newSet, lattice._batching);
        } else if (typeof sourceValue === 'object' && sourceValue !== null) {
          // Object update
          const cachedKey = (signal as any)._cachedIndex;
          if (cachedKey !== undefined && sourceValue[cachedKey] === currentValue) {
            // O(1) update using cached key
            const newObj = { ...sourceValue };
            if (typeof updates === 'function') {
              newObj[cachedKey] = updates(currentValue);
            } else if (typeof currentValue === 'object' && currentValue !== null) {
              newObj[cachedKey] = { ...currentValue, ...updates };
            } else {
              newObj[cachedKey] = updates;
            }
            updateSignalValue(source, newObj, lattice._batching);
          }
        }
      } else {
        // Regular signal update
        const currentValue = signal();
        let newValue: any;
        
        if (typeof updates === 'function') {
          newValue = updates(currentValue);
        } else if (typeof updates === 'object' && updates !== null && 
                   typeof currentValue === 'object' && currentValue !== null &&
                   !Array.isArray(currentValue) && !(currentValue instanceof Set) && 
                   !(currentValue instanceof Map)) {
          // Partial update for objects
          newValue = { ...currentValue, ...updates };
        } else {
          newValue = updates;
        }
        
        updateSignalValue(signal, newValue, lattice._batching);
        
        // Also update internal state if this is a store signal
        for (const key in stateSignals) {
          if (stateSignals[key] === signal) {
            (state as any)[key] = newValue;
            break;
          }
        }
      }
    });

    // Notify subscribers
    for (const listener of listeners) {
      listener();
    }
  }) as SetState<State>;


  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };
  const slices = component(context);

  // Add store methods
  return {
    ...slices,
    _getState: () => ({ ...state }),
    _subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/**
 * Creates a store from a component factory using an existing adapter
 */
export function createStoreWithAdapter<
  State extends Record<string, any>,
  Slices,
>(
  component: ComponentFactory<State, Slices>,
  adapter: StoreAdapter<State>
): Slices {
  // Create scoped lattice context
  const lattice = createLatticeContext<State>();

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
    // Create read-only wrapper that tracks dependencies
    const wrapper = (() => internalSig()) as Signal<State[K]>;
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
  });

  // Create set function that delegates to adapter
  const set: SetState<State> = ((signal: Signal<any>, updates: any) => {
    // For adapter stores, we need to update through the adapter
    // Find which state key this signal belongs to
    let stateKey: string | undefined;
    for (const key in stateSignals) {
      if (stateSignals[key] === signal || 
          (isDerivedSignal(signal) && getSourceSignal(signal) === stateSignals[key])) {
        stateKey = key;
        break;
      }
    }
    
    if (!stateKey) {
      throw new Error('Signal not found in store');
    }
    
    const currentValue = signal();
    
    let newValue: any;
    if (typeof updates === 'function') {
      newValue = updates(currentValue);
    } else if (typeof updates === 'object' && updates !== null && 
               typeof currentValue === 'object' && currentValue !== null &&
               !Array.isArray(currentValue) && !(currentValue instanceof Set) && 
               !(currentValue instanceof Map)) {
      // Partial update for objects
      newValue = { ...currentValue, ...updates };
    } else {
      newValue = updates;
    }
    
    // Update through adapter
    adapter.setState({ [stateKey]: newValue } as Partial<State>);
  }) as SetState<State>;

  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };
  return component(context);
}
