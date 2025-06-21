/**
 * @fileoverview Lattice Store - Framework-agnostic reactive state management
 *
 * This is the core state management implementation that was previously in @lattice/core.
 * It provides fine-grained reactivity and slice composition without framework dependencies.
 */

import {
  storeSliceMetadata,
  storeCompositionMetadata,
  getCompositionMetadata,
  getSliceMetadata,
} from '@lattice/core';

// Re-export metadata functions for internal framework use
export {
  storeSliceMetadata,
  storeCompositionMetadata,
  getCompositionMetadata,
  getSliceMetadata,
};

// Import core types from @lattice/core
import type {
  Selector,
  Selectors,
  SetState,
  SliceHandle,
  ReactiveSliceFactory,
  SubscribableStore,
} from '@lattice/core';

// Re-export for convenience
export type {
  Selector,
  Selectors,
  SetState,
  SliceHandle,
  ReactiveSliceFactory,
  SubscribableStore,
};

// ============================================================================
// Store-specific Types
// ============================================================================

export interface StoreTools<State> {
  get: () => State;
  set: (updates: Partial<State>) => void;
}

export type StoreSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => Methods;

// ============================================================================
// Store API Types
// ============================================================================

export interface StoreApi<State> {
  getState: () => State;
  setState: (updates: Partial<State>) => void;
  subscribe: (listener: () => void) => () => void;
  destroy?: () => void;
}

// ============================================================================
// Main Store Implementation
// ============================================================================

/**
 * Creates a store with pure serializable state and returns a slice factory.
 * This is the core state management primitive for Lattice.
 *
 * @param initialState - The initial state (must be serializable)
 * @returns A factory function for creating slices with behaviors that also implements SubscribableStore
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
export function createStore<State extends Record<string, unknown>>(
  initialState: State
): ReactiveSliceFactory<State> & {
  subscribe: (listener: () => void) => () => void;
} {
  let state = initialState;

  // Use dependency sets directly as keys
  const listenersByDependencySet = new Map<Set<string>, Set<() => void>>();

  // Helper to notify listeners - check Set intersection directly
  const notifyListeners = (changedKeys: Set<string>) => {
    for (const [dependencies, keyListeners] of listenersByDependencySet) {
      // Check if any dependency intersects with changed keys
      for (const dep of dependencies) {
        if (changedKeys.has(dep)) {
          for (const listener of keyListeners) {
            listener();
          }
          break;
        }
      }
    }
  };

  // Helper to create a selector
  function createSelector<T>(getValue: () => T, key: string): Selector<T> {
    const selector = () => getValue();

    selector.subscribe = (listener: () => void) => {
      const singleKeySet = new Set([key]);
      if (!listenersByDependencySet.has(singleKeySet)) {
        listenersByDependencySet.set(singleKeySet, new Set());
      }
      listenersByDependencySet.get(singleKeySet)!.add(listener);

      return () => {
        const keyListeners = listenersByDependencySet.get(singleKeySet);
        if (keyListeners) {
          keyListeners.delete(listener);
          if (keyListeners.size === 0) {
            listenersByDependencySet.delete(singleKeySet);
          }
        }
      };
    };

    selector._dependencies = new Set([key]);

    return selector as Selector<T>;
  }

  // Global subscribe method for the store
  const globalSubscribe = (listener: () => void) => {
    // Subscribe to all state changes - use Set of all keys
    const allKeysSet = new Set(Object.keys(initialState));
    if (!listenersByDependencySet.has(allKeysSet)) {
      listenersByDependencySet.set(allKeysSet, new Set());
    }
    listenersByDependencySet.get(allKeysSet)!.add(listener);

    return () => {
      const allListeners = listenersByDependencySet.get(allKeysSet);
      if (allListeners) {
        allListeners.delete(listener);
        if (allListeners.size === 0) {
          listenersByDependencySet.delete(allKeysSet);
        }
      }
    };
  };

  // Create the reactive slice factory function
  function createSlice<Deps, Computed>(
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
      actualSelectors[k] = createSelector(() => state[k], k);
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
        configurable: true,
      });
    }

    // Build dependency model
    const deps = depsFn(trackingSelectors);
    isTracking = false;

    // Check for composed dependencies using WeakMap
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

    // Create set function with two-phase pattern
    const set: SetState<State> = (depsFn, updateFn) => {
      const deps = depsFn(actualSelectors);
      const updates = updateFn(deps);
      const changedKeys = new Set<string>();

      // Mutate directly and track changes
      for (const key in updates) {
        const newValue = updates[key];
        if (newValue !== undefined && !Object.is(state[key], newValue)) {
          state[key] = newValue;
          changedKeys.add(key);
        }
      }

      if (changedKeys.size > 0) {
        notifyListeners(changedKeys);
      }
    };

    // Create computed values and actions
    const computed = computeFn(deps, set);

    // Subscribe function for this slice
    const subscribe = (listener: () => void) => {
      if (!listenersByDependencySet.has(dependencies)) {
        listenersByDependencySet.set(dependencies, new Set());
      }
      listenersByDependencySet.get(dependencies)!.add(listener);

      return () => {
        const depListeners = listenersByDependencySet.get(dependencies);
        if (depListeners) {
          depListeners.delete(listener);
          if (depListeners.size === 0) {
            listenersByDependencySet.delete(dependencies);
          }
        }
      };
    };

    // Create the slice handle with dual functionality
    function slice(): Computed;
    function slice<ChildDeps>(
      childDepsFn: (parent: Computed) => ChildDeps
    ): ChildDeps;
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
          storeCompositionMetadata(value, {
            slice: slice as SliceHandle<unknown>,
            dependencies,
          });
        }
      }

      return childDeps;
    }

    // Store metadata for testing/framework use
    storeSliceMetadata(slice as SliceHandle<Computed>, {
      dependencies,
      subscribe,
    });

    return slice as SliceHandle<Computed>;
  }

  // Add the subscribe method to the createSlice function
  (createSlice as any).subscribe = globalSubscribe;

  return createSlice as ReactiveSliceFactory<State> & {
    subscribe: (listener: () => void) => () => void;
  };
}

// ============================================================================
// Simplified API
// ============================================================================

/**
 * Creates a vanilla store with a simpler API, similar to Zustand.
 * This provides a more familiar interface for those coming from other state managers.
 *
 * @example
 * ```typescript
 * const store = createVanillaStore((set, get) => ({
 *   count: 0,
 *   increment: () => set({ count: get().count + 1 })
 * }));
 *
 * store.getState(); // { count: 0 }
 * store.setState({ count: 5 });
 * const unsub = store.subscribe(() => console.log('changed'));
 * ```
 */
export function createVanillaStore<T extends Record<string, any>>(
  initializer: (set: (partial: Partial<T>) => void, get: () => T) => T
): StoreApi<T> {
  // Simple state management with direct updates
  let state: T;
  const listeners = new Set<() => void>();

  // Cache for stable getState references
  let cachedSnapshot: T | null = null;
  let snapshotValid = false;

  const setState = (partial: Partial<T>) => {
    const nextState = { ...state, ...partial };

    // Only update if something actually changed
    let hasChanges = false;
    for (const key in partial) {
      if (!Object.is(state[key], nextState[key])) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      state = nextState;
      snapshotValid = false;
      listeners.forEach((listener) => listener());
    }
  };

  const getState = (): T => {
    if (snapshotValid && cachedSnapshot) {
      return cachedSnapshot;
    }

    // Create a new snapshot only including state properties (not methods)
    const snapshot: any = {};
    for (const key in state) {
      if (typeof state[key] !== 'function') {
        snapshot[key] = state[key];
      }
    }

    cachedSnapshot = snapshot;
    snapshotValid = true;
    return snapshot;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Initialize state with the initializer
  state = initializer(setState, getState);

  return {
    getState,
    setState,
    subscribe,
  };
}
