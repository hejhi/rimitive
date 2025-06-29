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
import { isSelectorResult, SelectorResult } from './selector-types';
import { createLatticeContext } from './lattice-context';
import { type StoreAdapter } from './adapter-contract';
import type { FromMarker } from './component-types';

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

  // Create set function that updates state
  const set: SetState<State> = ((arg1: any, arg2?: any) => {
    // Check if first argument is a selector result
    if (isSelectorResult(arg1)) {
      // Selector-based update
      const selector = arg1;
      const updates = arg2;

      if (!selector.value) {
        // Nothing to update if selector didn't find anything
        return;
      }

      // We need to find the value in the store and update it
      // This is O(n) but necessary since we don't have the signal/predicate info yet

      // Search through all signals to find and update the object
      for (const key in stateSignals) {
        const signal = stateSignals[key];
        const currentValue = signal();

        if (Array.isArray(currentValue)) {
          const index = currentValue.indexOf(selector.value);
          if (index !== -1) {
            const newArray = [...currentValue];
            if (typeof updates === 'function') {
              newArray[index] = updates(currentValue[index]);
            } else {
              newArray[index] = { ...currentValue[index], ...updates };
            }
            (signal as (value: any) => void)(newArray);
            return;
          }
        } else if (
          currentValue && typeof currentValue === 'object' && (currentValue as any) instanceof Set &&
          (currentValue as Set<any>).has(selector.value)
        ) {
          const newSet = new Set(currentValue);
          newSet.delete(selector.value);
          let newItem: any;
          if (typeof updates === 'function') {
            newItem = updates(selector.value);
          } else {
            newItem = { ...selector.value, ...updates };
          }
          newSet.add(newItem);
          (signal as (value: any) => void)(newSet);
          return;
        } else if (currentValue && typeof currentValue === 'object' && (currentValue as any) instanceof Map) {
          for (const [k, v] of currentValue as Map<any, any>) {
            if (v === selector.value) {
              let newItem: any;
              if (typeof updates === 'function') {
                newItem = updates(v);
              } else {
                newItem = { ...v, ...updates };
              }
              currentValue.set(k, newItem);
              (signal as (value: any) => void)(new Map(currentValue));
              return;
            }
          }
        } else if (currentValue === selector.value) {
          let newItem: any;
          if (typeof updates === 'function') {
            newItem = updates(currentValue);
          } else {
            newItem = { ...currentValue, ...updates };
          }
          signal(newItem);
          return;
        }
      }

      // Could not find selector value in any signal
      return;
    }

    // Original behavior - direct state update
    const updates = arg1;
    const newUpdates = typeof updates === 'function' ? updates(state) : updates;

    lattice._batch(() => {
      // Update internal state and signals
      for (const key in newUpdates) {
        if (!Object.is(state[key], newUpdates[key])) {
          (state as any)[key] = newUpdates[key]!;

          // Update existing signal or create new one
          if (stateSignals[key]) {
            stateSignals[key](newUpdates[key]!);
          } else {
            (stateSignals as any)[key] = lattice.signal(newUpdates[key]!);
          }
        }
      }
    });

    // Notify subscribers
    for (const listener of listeners) {
      listener();
    }
  }) as SetState<State>;

  // Create select function - simple wrapper for selector functions
  const select = <TArgs extends any[], TResult>(
    selectorFn: (...args: TArgs) => TResult | undefined
  ) => {
    return (...args: TArgs): SelectorResult<TResult> => {
      // Run the selector function to find the value
      const value = selectorFn(...args);
      
      // Return a selector result for use with set()
      return {
        __selector: true as const,
        value,
        signal: null,
        predicate: () => true,
      };
    };
  };

  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
    select,
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
            existingSig(newVal);
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
  const set: SetState<State> = ((arg1: any) => {
    // Check if first argument is a selector result
    if (isSelectorResult(arg1)) {
      // Selector-based updates not implemented for adapter stores yet
      throw new Error('Selector-based updates not yet supported in adapter stores');
    }
    
    // Original behavior - direct state update
    const updates = arg1;
    const currentState = adapter.getState();
    const newUpdates =
      typeof updates === 'function' ? updates(currentState) : updates;
    adapter.setState(newUpdates);
  }) as SetState<State>;

  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
    select: lattice.select,
  };
  return component(context);
}
