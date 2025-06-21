/**
 * @fileoverview Lattice runtime - bridges adapters to the reactive slice system
 *
 * The runtime takes any store adapter and adds the reactive slice layer on top,
 * providing fine-grained subscriptions and efficient computed state.
 */

import type { ReactiveSliceFactory, Selector, Selectors, SetState, SliceHandle } from './runtime-types';
import { storeSliceMetadata, storeCompositionMetadata, getCompositionMetadata } from './lib/metadata';
import { type StoreAdapter } from './adapter-contract';

/**
 * Component factory receives slice factory and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createSlice: ReactiveSliceFactory<State>
) => Component;

/**
 * Creates a reactive slice factory from a store adapter.
 *
 * This bridges any store adapter to the reactive slice system, adding:
 * - Fine-grained dependency tracking
 * - Efficient computed state
 * - Optimized slice-level subscriptions
 *
 * The adapter only needs to provide basic get/set/subscribe for the entire state.
 * Lattice handles all the reactive slice logic on top.
 *
 * @param adapter - The store adapter providing state management
 * @returns A reactive slice factory that creates fine-grained reactive slices
 *
 * @example
 * ```typescript
 * // Adapter provides basic store operations
 * const adapter = zustandAdapter(zustandStore);
 * 
 * // Lattice adds the reactive layer
 * const createSlice = createLatticeStore(adapter);
 * 
 * // Now slices have fine-grained subscriptions
 * const slice = createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({ value: () => count() })
 * );
 * ```
 */
export function createLatticeStore<State>(
  adapter: StoreAdapter<State>
): ReactiveSliceFactory<State> {
  // Create an internal store-like structure to manage fine-grained subscriptions
  let currentState = { ...adapter.getState() }; // Clone to avoid reference issues
  const listeners = new Map<string, Set<() => void>>();
  const keySetToString = (keys: Set<string>) => [...keys].sort().join('|');
  
  // Helper to create a selector with fine-grained subscription
  function createSelector<T>(
    getValue: () => T,
    key: string
  ): Selector<T> {
    const selector = () => getValue();
    
    selector.subscribe = (listener: () => void) => {
      const keyString = key; // Single key for individual selectors
      if (!listeners.has(keyString)) {
        listeners.set(keyString, new Set());
      }
      listeners.get(keyString)!.add(listener);
      
      return () => {
        const keyListeners = listeners.get(keyString);
        if (keyListeners) {
          keyListeners.delete(listener);
          if (keyListeners.size === 0) {
            listeners.delete(keyString);
          }
        }
      };
    };
    
    selector._dependencies = new Set([key]);
    
    return selector as Selector<T>;
  }
  
  // Initialize root selectors early to avoid hoisting issues
  const rootSelectors = {} as Selectors<State>;
  for (const key in currentState) {
    const k = key as Extract<keyof State, string>;
    rootSelectors[k] = createSelector(
      () => adapter.getState()[k],
      k
    );
  }
  
  // Helper to notify listeners when specific keys change
  const notifyListeners = (changedKeys: Set<string>) => {
    for (const [keyString, keyListeners] of listeners) {
      const keys = keyString.split('|');
      const shouldNotify = keys.some(key => changedKeys.has(key));
      if (shouldNotify) {
        keyListeners.forEach(listener => listener());
      }
    }
  };
  
  // When adapter notifies of any change, detect what actually changed
  adapter.subscribe(() => {
    const newState = adapter.getState();
    const changedKeys = new Set<string>();
    
    // Compare old and new state to find actual changes
    for (const key in newState) {
      if (!Object.is(currentState[key], newState[key])) {
        changedKeys.add(key);
      }
    }
    
    // Check for removed keys
    for (const key in currentState) {
      if (!Object.prototype.hasOwnProperty.call(newState, key)) {
        changedKeys.add(key);
      }
    }
    
    // Check for new keys and update root selectors
    for (const key in newState) {
      if (!(key in rootSelectors)) {
        const k = key as Extract<keyof State, string>;
        rootSelectors[k] = createSelector(
          () => adapter.getState()[k],
          k
        );
      }
    }
    
    currentState = { ...newState }; // Clone to maintain immutability
    
    if (changedKeys.size > 0) {
      notifyListeners(changedKeys);
    }
  });
  
  // Return the reactive slice factory
  return function createSlice<Deps, Computed>(
    depsFn: (selectors: Selectors<State>) => Deps,
    computeFn: (deps: Deps, set: SetState<State>) => Computed
  ): SliceHandle<Computed> {
    const dependencies = new Set<string>();
    
    // Create tracking-enabled selectors that wrap the root selectors
    let isTracking = true;
    const trackingSelectors = {} as Selectors<State>;
    
    // Track dependencies during selector access
    for (const key in currentState) {
      Object.defineProperty(trackingSelectors, key, {
        get() {
          if (isTracking) {
            dependencies.add(key);
          }
          return rootSelectors[key];
        },
        enumerable: true,
        configurable: true
      });
    }
    
    // Build dependency model
    const deps = depsFn(trackingSelectors);
    isTracking = false;
    
    // Check for composed dependencies
    for (const key in deps) {
      const value = deps[key];
      if (typeof value === 'function') {
        const composedInfo = getCompositionMetadata(value);
        if (composedInfo) {
          // Merge dependencies from the composed slice
          for (const dep of composedInfo.dependencies) {
            dependencies.add(dep);
          }
        }
      }
    }
    
    // Create set function that writes back to the adapter
    const set: SetState<State> = (depsFn, updateFn) => {
      const deps = depsFn(rootSelectors);
      const updates = updateFn(deps);
      adapter.setState(updates);
    };
    
    // Create computed values and actions
    const computed = computeFn(deps, set);
    
    // Subscribe function for this slice
    const subscribe = (listener: () => void) => {
      const keyString = keySetToString(dependencies);
      if (!listeners.has(keyString)) {
        listeners.set(keyString, new Set());
      }
      listeners.get(keyString)!.add(listener);
      
      return () => {
        const keyListeners = listeners.get(keyString);
        if (keyListeners) {
          keyListeners.delete(listener);
          if (keyListeners.size === 0) {
            listeners.delete(keyString);
          }
        }
      };
    };
    
    // Create the slice handle with dual functionality
    function slice(): Computed;
    function slice<ChildDeps>(childDepsFn: (parent: Computed) => ChildDeps): ChildDeps;
    function slice<ChildDeps>(childDepsFn?: (parent: Computed) => ChildDeps) {
      if (!childDepsFn) {
        return computed;
      }
      
      const childDeps = childDepsFn(computed);
      
      // Store composition metadata
      for (const key in childDeps) {
        const value = childDeps[key];
        if (typeof value === 'function') {
          storeCompositionMetadata(value, { slice: slice as SliceHandle<unknown>, dependencies });
        }
      }
      
      return childDeps;
    }
    
    // Store metadata for framework use
    storeSliceMetadata(slice as SliceHandle<Computed>, { dependencies, subscribe });
    
    return slice as SliceHandle<Computed>;
  };
}
