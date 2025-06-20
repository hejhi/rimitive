/**
 * @fileoverview Lattice runtime - bridges adapters to the reactive slice system
 *
 * The runtime takes any store adapter and adds the reactive slice layer on top,
 * providing fine-grained subscriptions and efficient computed state.
 */

import type { ReactiveSliceFactory, Selector, Selectors, SetState, SliceHandle } from './store';
import { type StoreAdapter } from './adapter-contract';
import { storeSliceMetadata, storeCompositionMetadata, getCompositionMetadata } from './internal/metadata';

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
  // Track all slice listeners by their dependency keys
  const sliceListeners = new Map<string, Set<() => void>>();
  const keySetToString = (keys: Set<string>) => [...keys].sort().join('|');
  
  // Track previous state to detect actual changes
  let previousState = { ...adapter.getState() };
  
  // When adapter notifies of any change, check which keys actually changed
  adapter.subscribe(() => {
    const currentState = adapter.getState();
    const changedKeys = new Set<string>();
    
    // Compare with previous state to detect actual changes
    for (const key in currentState) {
      if (!Object.is(previousState[key], currentState[key])) {
        changedKeys.add(key);
      }
    }
    
    // Update previous state
    previousState = { ...currentState };
    
    // Only notify if there were actual changes
    if (changedKeys.size > 0) {
      // Notify slice listeners whose dependencies changed
      for (const [keyString, listeners] of sliceListeners) {
        const keys = keyString.split('|');
        const shouldNotify = keys.some(key => changedKeys.has(key));
        if (shouldNotify) {
          listeners.forEach(listener => listener());
        }
      }
    }
  });
  
  // Helper to create a selector
  function createSelector<T>(
    getValue: () => T,
    key: string
  ): Selector<T> {
    const selector = () => getValue();
    
    selector.subscribe = (listener: () => void) => {
      const keyString = key;
      if (!sliceListeners.has(keyString)) {
        sliceListeners.set(keyString, new Set());
      }
      sliceListeners.get(keyString)!.add(listener);
      
      return () => {
        const listeners = sliceListeners.get(keyString);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            sliceListeners.delete(keyString);
          }
        }
      };
    };
    
    selector._dependencies = new Set([key]);
    
    return selector as Selector<T>;
  }
  
  // Return the reactive slice factory
  return function createSlice<Deps, Computed>(
    depsFn: (selectors: Selectors<State>) => Deps,
    computeFn: (deps: Deps, set: SetState<State>) => Computed
  ): SliceHandle<Computed> {
    const dependencies = new Set<string>();
    
    // Create tracking-enabled selectors
    let isTracking = true;
    const trackingSelectors = {} as Selectors<State>;
    const actualSelectors = {} as Selectors<State>;
    
    const state = adapter.getState();
    for (const key in state) {
      const k = key as Extract<keyof State, string>;
      actualSelectors[k] = createSelector(
        () => adapter.getState()[k],
        k
      );
    }
    
    // Track dependencies during selector access
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
      const deps = depsFn(actualSelectors);
      const updates = updateFn(deps);
      adapter.setState(updates);
    };
    
    // Create computed values and actions
    const computed = computeFn(deps, set);
    
    // Subscribe function for this slice
    const subscribe = (listener: () => void) => {
      const keyString = keySetToString(dependencies);
      if (!sliceListeners.has(keyString)) {
        sliceListeners.set(keyString, new Set());
      }
      sliceListeners.get(keyString)!.add(listener);
      
      return () => {
        const listeners = sliceListeners.get(keyString);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            sliceListeners.delete(keyString);
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
