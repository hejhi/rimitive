/**
 * @fileoverview Lattice runtime with simple, efficient caching
 * 
 * This implementation adds minimal-overhead caching using a different approach:
 * - Creates stable cached functions once during slice creation
 * - Uses version tracking for efficient invalidation
 * - No proxies or function wrapping on each call
 */

import type { ReactiveSliceFactory, Selector, Selectors, SetState, SliceHandle } from './runtime-types';
import { storeSliceMetadata, storeCompositionMetadata, getCompositionMetadata } from './lib/metadata';
import { type StoreAdapter } from './adapter-contract';

// Global version counter for tracking state changes
let globalVersion = 0;
const dependencyVersions = new WeakMap<StoreAdapter<any>, Map<string, number>>();

/**
 * Component factory receives slice factory and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createSlice: ReactiveSliceFactory<State>
) => Component;

/**
 * Creates a reactive slice factory with simple caching.
 */
export function createLatticeStore<State>(
  adapter: StoreAdapter<State>
): ReactiveSliceFactory<State> {
  // Initialize version tracking
  if (!dependencyVersions.has(adapter)) {
    const versions = new Map<string, number>();
    const initialState = adapter.getState();
    for (const key in initialState) {
      versions.set(key, 0);
    }
    dependencyVersions.set(adapter, versions);
  }
  
  let currentState = { ...adapter.getState() };
  const listeners = new Map<string, Set<() => void>>();
  const keySetToString = (keys: Set<string>) => [...keys].sort().join('|');
  
  // Helper to create a selector
  function createSelector<T>(
    getValue: () => T,
    key: string
  ): Selector<T> {
    const selector = () => getValue();
    
    selector.subscribe = (listener: () => void) => {
      const keyString = key;
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
  
  // Initialize root selectors
  const rootSelectors = {} as Selectors<State>;
  for (const key in currentState) {
    const k = key as Extract<keyof State, string>;
    rootSelectors[k] = createSelector(
      () => adapter.getState()[k],
      k
    );
  }
  
  // Helper to notify listeners
  const notifyListeners = (changedKeys: Set<string>) => {
    for (const [keyString, keyListeners] of listeners) {
      const keys = keyString.split('|');
      const shouldNotify = keys.some(key => changedKeys.has(key));
      if (shouldNotify) {
        keyListeners.forEach(listener => listener());
      }
    }
  };
  
  // Subscribe to adapter changes
  adapter.subscribe(() => {
    const newState = adapter.getState();
    const changedKeys = new Set<string>();
    const nextCurrentState = {} as State;
    const versions = dependencyVersions.get(adapter)!;
    
    // Find changes and update versions
    for (const key in newState) {
      const newValue = newState[key];
      nextCurrentState[key] = newValue;
      
      if (!Object.is(currentState[key], newValue)) {
        changedKeys.add(key);
        versions.set(key, ++globalVersion);
      }
      
      // Add new selectors if needed
      if (!(key in rootSelectors)) {
        const k = key as Extract<keyof State, string>;
        rootSelectors[k] = createSelector(
          () => adapter.getState()[k],
          k
        );
        versions.set(key, globalVersion);
      }
    }
    
    // Check for removed keys
    for (const key in currentState) {
      if (!Object.prototype.hasOwnProperty.call(newState, key)) {
        changedKeys.add(key);
        versions.delete(key);
      }
    }
    
    currentState = nextCurrentState;
    
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
    
    // Track dependencies
    let isTracking = true;
    const trackingSelectors = {} as Selectors<State>;
    
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
          for (const dep of composedInfo.dependencies) {
            dependencies.add(dep);
          }
        }
      }
    }
    
    // Create set function
    const set: SetState<State> = (updateFn) => {
      const updates = updateFn(rootSelectors);
      adapter.setState(updates);
    };
    
    // Create computed values
    const computedRaw = computeFn(deps, set);
    
    // Create cached version of computed values
    const computed: any = {};
    const cache: Record<string, { value: any; version: number }> = {};
    
    // Process each property of computedRaw
    for (const key in computedRaw) {
      const value = computedRaw[key as keyof typeof computedRaw];
      
      if (typeof value === 'function') {
        // Check if it's likely a getter (no parameters)
        const fn = value as Function;
        if (fn.length === 0) {
          // Create a cached version
          computed[key] = function cachedGetter(this: any) {
            const versions = dependencyVersions.get(adapter)!;
            
            // Calculate current version based on dependencies
            let currentVersion = 0;
            for (const dep of dependencies) {
              currentVersion += versions.get(dep) || 0;
            }
            
            // Check cache
            const cached = cache[key];
            if (cached && cached.version === currentVersion) {
              return cached.value;
            }
            
            // Compute and cache
            const result = fn.call(this);
            cache[key] = { value: result, version: currentVersion };
            return result;
          };
        } else {
          // Not a getter, pass through as-is
          computed[key] = value;
        }
      } else {
        // Not a function, pass through
        computed[key] = value;
      }
    }
    
    // Subscribe function
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
    
    // Create the slice handle
    function slice(): Computed;
    function slice<ChildDeps>(childDepsFn: (parent: Computed) => ChildDeps): ChildDeps;
    function slice<ChildDeps>(childDepsFn?: (parent: Computed) => ChildDeps) {
      if (!childDepsFn) {
        return computed as Computed;
      }
      
      const childDeps = childDepsFn(computed as Computed);
      
      // Store composition metadata
      for (const key in childDeps) {
        const value = childDeps[key];
        if (typeof value === 'function') {
          storeCompositionMetadata(value, { slice: slice as SliceHandle<unknown>, dependencies });
        }
      }
      
      return childDeps;
    }
    
    // Store metadata
    storeSliceMetadata(slice as SliceHandle<Computed>, { dependencies, subscribe });
    
    return slice as SliceHandle<Computed>;
  };
}