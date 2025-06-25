/**
 * @fileoverview Lattice runtime - bridges adapters to the reactive slice system
 *
 * The runtime takes any store adapter and adds the reactive slice layer on top,
 * providing fine-grained subscriptions and efficient computed state.
 */

import type { ReactiveSliceFactory, Selector, Selectors, SetState, SliceHandle } from './runtime-types';
import { storeSliceMetadata, storeCompositionMetadata, getCompositionMetadata, getSliceMetadata } from './lib/metadata';
import { type StoreAdapter } from './adapter-contract';

// Cache management - all computed functions are automatically cached
const sliceCacheMap = new WeakMap<SliceHandle<any>, Map<string, { value: any; dependencies: Set<string> }>>();
const activeSlices = new Set<{ slice: SliceHandle<any>; cache: Map<string, { value: any; dependencies: Set<string> }> }>();


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
    const nextCurrentState = {} as State;
    
    // Compare old and new state to find actual changes, building new currentState
    for (const key in newState) {
      const newValue = newState[key];
      nextCurrentState[key] = newValue; // Build new state object during iteration
      
      if (!Object.is(currentState[key], newValue)) {
        changedKeys.add(key);
      }
      
      // Check for new keys and update root selectors
      if (!(key in rootSelectors)) {
        const k = key as Extract<keyof State, string>;
        rootSelectors[k] = createSelector(
          () => adapter.getState()[k],
          k
        );
      }
    }
    
    // Check for removed keys
    for (const key in currentState) {
      if (!Object.prototype.hasOwnProperty.call(newState, key)) {
        changedKeys.add(key);
      }
    }
    
    currentState = nextCurrentState;
    
    // Clear caches for slices that depend on changed keys
    if (changedKeys.size > 0) {
      for (const { slice, cache } of activeSlices) {
        // Check if this slice depends on any changed keys
        const sliceMetadata = getSliceMetadata(slice);
        if (sliceMetadata) {
          const shouldClearCache = [...sliceMetadata.dependencies].some(dep => changedKeys.has(dep));
          if (shouldClearCache) {
            cache.clear();
          }
        }
      }
      
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
    const set: SetState<State> = (updateFn) => {
      const updates = updateFn(rootSelectors);
      adapter.setState(updates);
    };
    
    // Create computed values and actions with caching support
    const computedRaw = computeFn(deps, set);
    
    // Initialize cache for this slice
    const sliceCache = new Map<string, { value: any; dependencies: Set<string> }>();
    
    // Wrap all computed functions to add automatic caching
    const computed: typeof computedRaw = {} as any;
    
    // Helper to detect if a function is likely a getter (not an action)
    const isGetter = (fn: Function): boolean => {
      // Check if function uses set parameter (likely an action)
      const fnString = fn.toString();
      if (fnString.includes('set(') || fnString.includes('set )')) {
        return false;
      }
      
      // If function has no parameters, it's likely a getter
      return fn.length === 0;
    };
    
    for (const key in computedRaw) {
      const value = computedRaw[key];
      
      if (typeof value === 'function' && isGetter(value)) {
        // Create cached version only for getter functions
        computed[key] = (() => {
          const cached = sliceCache.get(key);
          
          // Check if we have a valid cache entry
          if (cached && cached.dependencies.size > 0) {
            return cached.value;
          }
          
          // Compute new value and store with slice dependencies
          const result = value();
          
          // Store in cache with slice-level dependencies
          sliceCache.set(key, {
            value: result,
            dependencies: dependencies // Use slice dependencies, not function-specific
          });
          
          return result;
        }) as any;
      } else {
        // Non-getter functions and non-function values pass through
        computed[key] = value;
      }
    }
    
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
    
    // Store cache reference for cleanup
    sliceCacheMap.set(slice as SliceHandle<Computed>, sliceCache);
    activeSlices.add({ slice: slice as SliceHandle<any>, cache: sliceCache });
    
    // Store metadata for framework use
    storeSliceMetadata(slice as SliceHandle<Computed>, { dependencies, subscribe });
    
    return slice as SliceHandle<Computed>;
  };
}
