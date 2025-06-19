/**
 * @fileoverview Reactive store implementation with dependency tracking
 * 
 * This module provides an enhanced createStore that tracks dependencies
 * and enables fine-grained reactive subscriptions without using Proxies.
 */

import type { StoreAdapter } from './adapter-contract';

// ============================================================================
// Types
// ============================================================================

export type Selector<T> = {
  (): T;
  subscribe: (listener: () => void) => () => void;
  _dependencies: Set<string>;
};

export type Selectors<State> = {
  [K in keyof State]: Selector<State[K]>;
};

export type SetState<State> = <Deps>(
  depsFn: (selectors: Selectors<State>) => Deps,
  updateFn: (deps: Deps) => Partial<State>
) => void;

export type SliceFactory<State, Deps, Computed> = {
  (depsFn: (selectors: Selectors<State>) => Deps, computeFn: (deps: Deps, set: SetState<State>) => Computed): Slice<State, Computed>;
};

export type Slice<State, Computed> = Computed & {
  <ChildDeps, ChildComputed>(
    depsFn: (parent: Computed) => ChildDeps,
    computeFn: (deps: ChildDeps, set: SetState<State>) => ChildComputed
  ): Slice<State, ChildComputed>;
  _dependencies: Set<string>;
  _subscribe: (listener: () => void) => () => void;
};

// Extended adapter interface with optional keyed subscriptions
export interface ReactiveStoreAdapter<State> extends StoreAdapter<State> {
  subscribeToKeys?: (keys: Set<string>, listener: () => void) => () => void;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates a selector that tracks when it's accessed
 */
function createSelector<T>(
  getValue: () => T,
  key: string,
  onAccess?: () => void
): Selector<T> {
  const dependencies = new Set<string>([key]);
  
  const selector = () => {
    if (onAccess) {
      onAccess();
    }
    return getValue();
  };
  
  // For now, subscribe to all changes (will be optimized with keyed subscriptions)
  selector.subscribe = (_listener: () => void) => {
    // This will be connected to the store's subscription system
    return () => {};
  };
  
  selector._dependencies = dependencies;
  
  return selector as Selector<T>;
}

/**
 * Creates a reactive store with dependency tracking
 */
export function createReactiveStore<State>(
  initialState: State,
  adapter?: ReactiveStoreAdapter<State>
): SliceFactory<State, any, any> {
  let state = initialState;
  const listeners = new Map<Set<string>, Set<() => void>>();
  const globalListeners = new Set<() => void>();
  
  // Helper to notify listeners
  const notifyListeners = (changedKeys: Set<string>) => {
    // Notify keyed listeners
    for (const [keys, keyListeners] of listeners) {
      const shouldNotify = [...keys].some(key => changedKeys.has(key));
      if (shouldNotify) {
        keyListeners.forEach(listener => listener());
      }
    }
    
    // Notify global listeners
    globalListeners.forEach(listener => listener());
  };
  
  // Create the store adapter if not provided
  const store: ReactiveStoreAdapter<State> = adapter || {
    getState: () => state,
    setState: (updates) => {
      const changedKeys = new Set<string>();
      
      // Track which keys changed
      for (const key in updates) {
        if (!Object.is(state[key], updates[key])) {
          changedKeys.add(key);
        }
      }
      
      if (changedKeys.size > 0) {
        state = { ...state, ...updates };
        notifyListeners(changedKeys);
      }
    },
    subscribe: (listener) => {
      globalListeners.add(listener);
      return () => {
        globalListeners.delete(listener);
      };
    },
    subscribeToKeys: (keys, listener) => {
      if (!listeners.has(keys)) {
        listeners.set(keys, new Set());
      }
      listeners.get(keys)!.add(listener);
      
      return () => {
        const keyListeners = listeners.get(keys);
        if (keyListeners) {
          keyListeners.delete(listener);
          if (keyListeners.size === 0) {
            listeners.delete(keys);
          }
        }
      };
    }
  };
  
  // Create slice factory
  return function createSlice<Deps, Computed>(
    depsFn: (selectors: Selectors<State>) => Deps,
    computeFn: (deps: Deps, set: SetState<State>) => Computed
  ): Slice<State, Computed> {
    const dependencies = new Set<string>();
    
    // Create tracking-enabled selectors using getter
    let isTracking = true;
    const trackingSelectors = {} as Selectors<State>;
    const actualSelectors = {} as Selectors<State>;
    
    for (const key in state) {
      const k = key; // Capture key in closure
      actualSelectors[k] = createSelector(
        () => store.getState()[k],
        k
      );
    }
    
    // Create a proxy-like object using Object.defineProperty
    for (const key in state) {
      Object.defineProperty(trackingSelectors, key, {
        get() {
          if (isTracking) {
            dependencies.add(key);
          }
          return actualSelectors[key];
        },
        enumerable: true,
        configurable: true
      });
    }
    
    // Build dependency model - tracks which selectors are used
    const deps = depsFn(trackingSelectors);
    
    // Stop tracking after initial dependency collection
    isTracking = false;
    
    // Use actual selectors for the rest of the lifecycle
    const selectors = actualSelectors;
    
    // Create set function with two-phase pattern
    const set: SetState<State> = (depsFn, updateFn) => {
      const deps = depsFn(selectors);
      const updates = updateFn(deps);
      store.setState(updates);
    };
    
    // Create computed values and actions
    const computed = computeFn(deps, set);
    
    // Subscribe function that uses keyed subscriptions if available
    const subscribe = (listener: () => void) => {
      if (store.subscribeToKeys && dependencies.size > 0) {
        return store.subscribeToKeys(dependencies, listener);
      }
      // Fall back to global subscription
      return store.subscribe(listener);
    };
    
    // Create the slice with composition support
    const slice: any = {
      ...computed,
      _dependencies: dependencies,
      _subscribe: subscribe
    };
    
    // Make the slice itself callable for composition
    const createChildSlice = function<ChildDeps, ChildComputed>(
      childDepsFn: (parent: Computed) => ChildDeps,
      childComputeFn: (deps: ChildDeps, set: SetState<State>) => ChildComputed
    ): Slice<State, ChildComputed> {
      // Create child slice with access to parent computed values
      const childDeps = childDepsFn(computed);
      const childComputed = childComputeFn(childDeps, set);
      
      // Merge dependencies
      const childDependencies = new Set([...dependencies]);
      
      // Return a new slice with composition support
      const childSlice: any = {
        ...childComputed,
        _dependencies: childDependencies,
        _subscribe: subscribe
      };
      
      // Make the child slice composable too
      Object.setPrototypeOf(childSlice, createChildSlice);
      
      return childSlice as Slice<State, ChildComputed>;
    };
    
    // Set the prototype to make the slice callable
    Object.setPrototypeOf(slice, createChildSlice);
    
    return slice as Slice<State, Computed>;
  };
}