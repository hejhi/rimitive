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

export type ReactiveSliceFactory<State> = <Deps, Computed>(
  depsFn: (selectors: Selectors<State>) => Deps,
  computeFn: (deps: Deps, set: SetState<State>) => Computed
) => Computed & {
  _dependencies: Set<string>;
  _subscribe: (listener: () => void) => () => void;
};

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
export function createStore<State>(
  initialState: State
): ReactiveSliceFactory<State> {
  let state = initialState;
  const listeners = new Map<Set<string>, Set<() => void>>();
  
  // Helper to notify listeners
  const notifyListeners = (changedKeys: Set<string>) => {
    for (const [keys, keyListeners] of listeners) {
      const shouldNotify = [...keys].some(key => changedKeys.has(key));
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
      const keys = new Set([key]);
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
    };
    
    selector._dependencies = new Set([key]);
    
    return selector as Selector<T>;
  }
  
  // Return the reactive slice factory
  return function createSlice<Deps, Computed>(
    depsFn: (selectors: Selectors<State>) => Deps,
    computeFn: (deps: Deps, set: SetState<State>) => Computed
  ): Computed & { _dependencies: Set<string>; _subscribe: (listener: () => void) => () => void } {
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
      if (!listeners.has(dependencies)) {
        listeners.set(dependencies, new Set());
      }
      listeners.get(dependencies)!.add(listener);
      
      return () => {
        const depListeners = listeners.get(dependencies);
        if (depListeners) {
          depListeners.delete(listener);
          if (depListeners.size === 0) {
            listeners.delete(dependencies);
          }
        }
      };
    };
    
    return {
      ...computed,
      _dependencies: dependencies,
      _subscribe: subscribe
    };
  };
}