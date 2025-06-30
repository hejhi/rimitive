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
 * Creates a store from a component factory and initial state
 */
export function createStore<State extends Record<string, any>>(
  initialState: State,
  middleware?: Array<(ctx: ComponentContext<State>) => ComponentContext<State>>
) {
  return <Slices>(component: (context: ComponentContext<State>) => Slices): Slices & {
    _getState: () => State;
    _subscribe: (fn: () => void) => () => void;
  } => {
  // Create internal state management
  let state = { ...initialState };
  const listeners = new Set<() => void>();

  // Create scoped lattice context
  const lattice = createLatticeContext();

  // Create state signals
  const stateSignals = {} as SignalState<State>;
  for (const key in state) {
    stateSignals[key] = lattice.signal(state[key]);
  }

  // Type guard for update functions
  function isUpdateFunction<T>(value: unknown): value is (current: T) => T {
    return typeof value === 'function';
  }

  // Create set function that updates signals
  const set: SetState = (<T>(
    signal: Signal<T>,
    updates: T | ((current: T) => T) | Partial<T>
  ) => {
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
          const cachedIndex = (signal as DerivedSignal<unknown, unknown>)
            ._cachedIndex as number;
          if (
            cachedIndex !== undefined &&
            sourceValue[cachedIndex] === currentValue
          ) {
            // O(1) update using cached position
            const newArray = [...sourceValue];
            if (isUpdateFunction(updates)) {
              newArray[cachedIndex] = updates(currentValue);
            } else if (
              typeof currentValue === 'object' &&
              currentValue !== null
            ) {
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
              if (isUpdateFunction(updates)) {
                newArray[index] = updates(currentValue);
              } else if (
                typeof currentValue === 'object' &&
                currentValue !== null
              ) {
                newArray[index] = { ...currentValue, ...updates };
              } else {
                newArray[index] = updates;
              }
              updateSignalValue(source, newArray, lattice._batching);
            }
          }
        } else if (sourceValue instanceof Map) {
          const cachedKey = (signal as DerivedSignal<unknown, unknown>)
            ._cachedIndex;
          if (
            cachedKey !== undefined &&
            sourceValue.get(cachedKey) === currentValue
          ) {
            // O(1) update using cached key
            const newMap = new Map(sourceValue);
            if (isUpdateFunction(updates)) {
              newMap.set(cachedKey, updates(currentValue));
            } else if (
              typeof currentValue === 'object' &&
              currentValue !== null
            ) {
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
          if (isUpdateFunction(updates)) {
            newSet.add(updates(currentValue));
          } else if (
            typeof currentValue === 'object' &&
            currentValue !== null
          ) {
            newSet.add({ ...currentValue, ...updates });
          } else {
            newSet.add(updates);
          }
          updateSignalValue(source, newSet, lattice._batching);
        } else if (typeof sourceValue === 'object' && sourceValue !== null) {
          // Object update
          const cachedKey = (signal as DerivedSignal<unknown, unknown>)
            ._cachedIndex as string;
          const sourceObj = sourceValue as Record<string, unknown>;
          if (
            cachedKey !== undefined &&
            sourceObj[cachedKey] === currentValue
          ) {
            // O(1) update using cached key
            const newObj = { ...sourceObj };
            if (isUpdateFunction(updates)) {
              newObj[cachedKey] = updates(currentValue);
            } else if (
              typeof currentValue === 'object' &&
              currentValue !== null
            ) {
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
        let newValue: T;

        if (isUpdateFunction(updates)) {
          newValue = updates(currentValue) as T;
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
          newValue = { ...currentValue, ...updates } as T;
        } else {
          newValue = updates as T;
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
  }) as SetState;

  // Create component slices with merged context
  let context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };
  
  // Apply middleware if provided
  if (middleware && middleware.length > 0) {
    context = middleware.reduce((ctx, mw) => mw(ctx), context);
  }
  
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
  };
}

/**
 * Creates a store from a component factory using an existing adapter
 */
export function createStoreWithAdapter<State extends Record<string, any>>(
  adapter: StoreAdapter<State>,
  middleware?: Array<(ctx: ComponentContext<State>) => ComponentContext<State>>
) {
  return <Slices>(component: (context: ComponentContext<State>) => Slices): Slices => {
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
  const set: SetState = ((signal: Signal<any>, updates: any) => {
    // For adapter stores, we need to update through the adapter
    // Find which state key this signal belongs to
    let stateKey: string | undefined;
    for (const key in stateSignals) {
      if (
        stateSignals[key] === signal ||
        (isDerivedSignal(signal) &&
          getSourceSignal(signal) === stateSignals[key])
      ) {
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

  // Create component slices with merged context
  let context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };
  
  // Apply middleware if provided
  if (middleware && middleware.length > 0) {
    context = middleware.reduce((ctx, mw) => mw(ctx), context);
  }
  
    return component(context);
  };
}
