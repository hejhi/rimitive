// Standalone store implementation without runtime dependencies

export interface StoreTools<State> {
  get: () => State;
  set: (updates: Partial<State>) => void;
}

export type StoreSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => Methods;

// Types for reactive slice system
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

// Internal metadata type - not exposed in public API
type ComposedFrom = {
  slice: SliceHandle<unknown>;
  dependencies: Set<string>;
};

// Clean public type without metadata exposure
export interface SliceHandle<Computed> {
  (): Computed;
  <ChildDeps>(depsFn: (parent: Computed) => ChildDeps): ChildDeps;
}

export type ReactiveSliceFactory<State> = <Deps, Computed>(
  depsFn: (selectors: Selectors<State>) => Deps,
  computeFn: (deps: Deps, set: SetState<State>) => Computed
) => SliceHandle<Computed>;

// Metadata access for framework integration and testing
export interface SliceMetadata {
  dependencies: Set<string>;
  subscribe: (listener: () => void) => () => void;
}

export interface StoreWithMetadata<State> {
  createSlice: ReactiveSliceFactory<State>;
  getMetadata: (slice: SliceHandle<any>) => SliceMetadata | undefined;
}

/**
 * Creates a store with pure serializable state and returns a slice factory.
 * This is the new primary API that separates state from behaviors.
 *
 * Note: This creates an isolated state container. For production use,
 * prefer using createLatticeStore with an adapter for proper state management.
 *
 * @param initialState - The initial state (must be serializable)
 * @returns A factory function for creating slices with behaviors
 *
 * @example
 * ```typescript
 * const createSlice = createStore({ count: 0, name: "John" });
 *
 * const counter = createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({
 *     count: () => count(),
 *     increment: () => set(
 *       (selectors) => ({ count: selectors.count }),
 *       ({ count }) => ({ count: count() + 1 })
 *     )
 *   })
 * );
 * ```
 */
// Internal factory that optionally captures metadata
function createStoreInternal<State>(
  initialState: State,
  metadataCapture?: WeakMap<Function, SliceMetadata>
): ReactiveSliceFactory<State> {
  let state = initialState;
  // Use string keys for reliable Map lookups
  const listeners = new Map<string, Set<() => void>>();
  const keySetToString = (keys: Set<string>) => [...keys].sort().join('|');
  
  // Store-scoped WeakMap to store composition metadata without polluting objects
  const compositionMetadata = new WeakMap<Function, ComposedFrom>();
  
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
  
  // Helper to create a selector
  function createSelector<T>(
    getValue: () => T,
    key: string
  ): Selector<T> {
    const selector = () => getValue();
    
    selector.subscribe = (listener: () => void) => {
      const keyString = key; // Single key, no need to sort
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
    
    for (const key in state) {
      const k = key; // Capture key in closure
      actualSelectors[k] = createSelector(
        () => state[k],
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
    
    // Check for composed dependencies using WeakMap
    for (const key in deps) {
      const value = deps[key];
      if (typeof value === 'function') {
        const composedInfo = compositionMetadata.get(value);
        if (composedInfo) {
          // Merge dependencies from the composed slice
          for (const dep of composedInfo.dependencies) {
            dependencies.add(dep);
          }
        }
      }
    }
    
    // Create set function with two-phase pattern
    const set: SetState<State> = (depsFn, updateFn) => {
      const deps = depsFn(actualSelectors);
      const updates = updateFn(deps);
      
      const changedKeys = new Set<string>();
      for (const key in updates) {
        if (!Object.is(state[key], updates[key])) {
          changedKeys.add(key);
        }
      }
      
      if (changedKeys.size > 0) {
        state = { ...state, ...updates };
        notifyListeners(changedKeys);
      }
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
        const depListeners = listeners.get(keyString);
        if (depListeners) {
          depListeners.delete(listener);
          if (depListeners.size === 0) {
            listeners.delete(keyString);
          }
        }
      };
    };
    
    // Create the slice function that returns computed values when called
    function slice(): Computed;
    function slice<ChildDeps>(childDepsFn: (parent: Computed) => ChildDeps): ChildDeps;
    function slice<ChildDeps>(childDepsFn?: (parent: Computed) => ChildDeps) {
      // If called without arguments, return the computed object
      if (!childDepsFn) {
        return computed;
      }
      
      // Otherwise, handle composition
      const childDeps = childDepsFn(computed);
      
      // Store metadata separately without polluting the returned object
      for (const key in childDeps) {
        const value = childDeps[key];
        if (typeof value === 'function') {
          compositionMetadata.set(value, { slice: slice as SliceHandle<unknown>, dependencies });
        }
      }
      
      return childDeps;
    }
    
    // Store metadata if capture is provided
    if (metadataCapture) {
      metadataCapture.set(slice, { dependencies, subscribe });
    }
    
    return slice as SliceHandle<Computed>;
  };
}

/**
 * Creates a store with pure serializable state and returns a slice factory.
 * This is the simple API that hides all internals.
 */
export function createStore<State>(
  initialState: State
): ReactiveSliceFactory<State> {
  return createStoreInternal(initialState);
}

/**
 * Creates a store with metadata access for framework integration and testing.
 * This is the advanced API that exposes internals.
 * 
 * @param initialState - The initial state (must be serializable)
 * @returns Object with createSlice factory and getMetadata function
 * 
 * @example
 * ```typescript
 * const store = createStoreWithMetadata({ count: 0 });
 * 
 * const slice = store.createSlice(
 *   (selectors) => ({ count: selectors.count }),
 *   ({ count }, set) => ({
 *     increment: () => set(
 *       (selectors) => ({ count: selectors.count }),
 *       ({ count }) => ({ count: count() + 1 })
 *     )
 *   })
 * );
 * 
 * // Access metadata for testing or framework integration
 * const metadata = store.getMetadata(slice);
 * console.log(metadata?.dependencies); // Set { 'count' }
 * ```
 */
export function createStoreWithMetadata<State>(
  initialState: State
): StoreWithMetadata<State> {
  const sliceMetadata = new WeakMap<Function, SliceMetadata>();
  const createSlice = createStoreInternal(initialState, sliceMetadata);
  
  return {
    createSlice,
    getMetadata: (slice: SliceHandle<any>) => sliceMetadata.get(slice)
  };
}