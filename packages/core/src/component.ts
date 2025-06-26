/**
 * @fileoverview Component-scoped Lattice implementation
 * 
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type {
  ComponentFactory,
  ComponentContext,
  ComponentMiddleware,
  SetState,
  SignalState,
  Signal,
} from './runtime-types';
import { createLatticeContext } from './lattice-context';
import { type StoreAdapter } from './adapter-contract';

/**
 * Marker interface that carries state type and middleware information
 */
interface InitMarker<State> {
  _state: State;
  _initial: State;
  _middleware: ComponentMiddleware<State>[];
}

/**
 * Creates a state marker with optional initializer and middleware
 */
export function init<State extends Record<string, any>>(
  initializer: () => State,
  ...middleware: ComponentMiddleware<State>[]
): InitMarker<State>;

export function init<State extends Record<string, any>>(
  ...middleware: ComponentMiddleware<State>[]
): InitMarker<State>;

export function init<State extends Record<string, any>>(
  initializerOrMiddleware?: (() => State) | ComponentMiddleware<State>,
  ...restMiddleware: ComponentMiddleware<State>[]
): InitMarker<State> {
  // Check if it's an initializer function (has no parameters)
  const isInitializer = typeof initializerOrMiddleware === 'function' && 
    initializerOrMiddleware.length === 0 &&
    !('_middleware' in initializerOrMiddleware);
    
  if (isInitializer) {
    // Safe to call as initializer
    const initial = (initializerOrMiddleware as () => State)();
    return {
      _state: initial,
      _initial: initial,
      _middleware: restMiddleware
    };
  } else {
    // It's middleware or nothing
    const middleware = initializerOrMiddleware 
      ? [initializerOrMiddleware as ComponentMiddleware<State>, ...restMiddleware]
      : restMiddleware;
    return {
      _state: {} as State,
      _initial: {} as State,
      _middleware: middleware
    };
  }
}

/**
 * Creates a component factory from a state marker and factory function
 */
export function createComponent<Marker extends InitMarker<any>, Slices>(
  marker: Marker,
  factory: (ctx: ComponentContext<Marker['_state']>) => Slices
): ComponentFactory<Marker['_state'], Slices> {
  type State = Marker['_state'];
  const middleware = marker._middleware;
  
  // Return wrapped factory that applies middleware
  return (context: ComponentContext<State>) => {
    // Apply middleware in order
    const enhancedContext = middleware.reduce(
      (ctx, mw) => mw(ctx),
      context
    );
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
): Slices & { _getState: () => State; _subscribe: (fn: () => void) => () => void } {
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
  const set: SetState<State> = (updates) => {
    const newUpdates = typeof updates === 'function' ? updates(stateSignals) : updates;
    
    lattice._batch(() => {
      // Update internal state and signals
      for (const key in newUpdates) {
        if (!Object.is(state[key], newUpdates[key])) {
          state[key] = newUpdates[key]!;
          
          // Update existing signal or create new one
          if (stateSignals[key]) {
            stateSignals[key](newUpdates[key]!);
          } else {
            stateSignals[key] = lattice.signal(newUpdates[key]!);
          }
        }
      }
    });
    
    // Notify subscribers
    for (const listener of listeners) {
      listener();
    }
  };
  
  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set
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
export function createStoreWithAdapter<State extends Record<string, any>, Slices>(
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
  (Object.keys(state) as StateKey[]).forEach(key => {
    const internalSig = lattice.signal(state[key]);
    internalSignals.set(key, internalSig);
    stateSignals[key] = createReadOnlySignal(internalSig);
  });
  
  // Subscribe to adapter changes
  adapter.subscribe(() => {
    lattice._batch(() => {
      const newState = adapter.getState();
      
      // Update signals with new state
      (Object.keys(newState) as StateKey[]).forEach(key => {
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
  const set: SetState<State> = (updates) => {
    const newUpdates = typeof updates === 'function' ? updates(stateSignals) : updates;
    adapter.setState(newUpdates);
  };
  
  
  // Create component slices with merged context
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set
  };
  return component(context);
}