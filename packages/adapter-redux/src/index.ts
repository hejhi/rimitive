/**
 * @fileoverview Redux adapter for Lattice
 *
 * This adapter provides integration with Redux for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import {
  configureStore,
  createSlice as createReduxSlice,
  type EnhancedStore,
  type ConfigureStoreOptions,
  type Middleware,
  type Slice,
} from '@reduxjs/toolkit';
import type { StoreAdapter, CreateStore } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Redux adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Type for Redux store enhancer functions
 */
export type StoreEnhancer<State> = (
  config: ConfigureStoreOptions<State>
) => EnhancedStore<State>;

/**
 * Creates a Redux adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Redux. It combines
 * an component factory with Redux's state management.
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Redux
 *
 * @example
 * ```typescript
 * const createComponent = (createStore: CreateStore) => {
 *   const createSlice = createStore({ count: 0 });
 *
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const store = createReduxAdapter(createComponent);
 * store.counter.increment();
 * ```
 */
export function createReduxAdapter<Component>(
  componentFactory: (createStore: CreateStore<any>) => Component,
  enhancer?: StoreEnhancer<any>,
  options?: AdapterOptions
): Component {
  // Use the runtime to create the store with inferred state type
  return createLatticeStore(componentFactory, (initialState) => {
    // Create adapter with the initial state
    const adapter = createStoreAdapter(initialState, options);

    // If enhancer is provided, we need to recreate with enhancer
    if (enhancer) {
      const enhancedAdapter = createStoreAdapter(enhancer, options);
      enhancedAdapter.setState(initialState);
      return enhancedAdapter;
    }

    return adapter;
  });
}

/**
 * Creates a minimal Redux adapter
 *
 * This creates a new Redux store with minimal wrapping.
 * When used via createReduxAdapter, the initial state comes from
 * the component factory's createStore call, not this parameter.
 *
 * ## Notification Behavior
 *
 * This adapter implements sophisticated notification handling:
 * - Single subscription to the underlying Redux store
 * - All Lattice listeners are managed separately for better control
 * - Ensures consistent behavior and proper error isolation
 *
 * ## Edge Cases Handled
 * - Listeners that throw errors don't prevent other listeners from executing
 * - Unsubscribing during notification is deferred until the cycle completes
 * - All listeners in a notification cycle see consistent state
 *
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 */
export function createStoreAdapter<Model>(
  enhancerOrInitialState?: StoreEnhancer<Model> | Model,
  options?: AdapterOptions
): StoreAdapter<Model> {
  // Determine if first argument is an enhancer or initial state
  let enhancer: StoreEnhancer<Model> | undefined;
  let initialState: Model;

  if (typeof enhancerOrInitialState === 'function') {
    enhancer = enhancerOrInitialState as StoreEnhancer<Model>;
    initialState = {} as Model;
  } else {
    enhancer = undefined;
    initialState = enhancerOrInitialState ?? ({} as Model);
  }
  // Create Redux slice for state management
  const slice = createReduxSlice({
    name: 'lattice',
    initialState: initialState,
    reducers: {
      updateState: (state, action) => {
        // Type assertion needed due to Immer's Draft type
        Object.assign(state as any, action.payload);
      },
    },
  });

  // Default store configuration
  const defaultConfig: ConfigureStoreOptions<Model> = {
    reducer: slice.reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  };

  // Create Redux store with or without enhancer
  const store = enhancer
    ? enhancer(defaultConfig)
    : configureStore(defaultConfig);

  // Use wrapReduxStore to handle all the subscription management
  return wrapReduxStore(store, options, slice);
}

/**
 * Wraps an existing Redux store as a minimal adapter
 *
 * This allows you to use an existing Redux store with Lattice.
 * Uses the same sophisticated subscription management as createStoreAdapter
 * to handle edge cases like unsubscribe during notification.
 *
 * @param store - An existing Redux store
 * @param options - Optional configuration for the adapter
 * @param slice - Optional slice for state updates (created if not provided)
 * @returns A minimal store adapter with proper subscription management
 *
 * @example
 * ```typescript
 * const reduxStore = configureStore({ reducer: rootReducer });
 * const adapter = wrapReduxStore(reduxStore);
 * const store = createLatticeStore(componentFactory, adapter);
 * ```
 */
export function wrapReduxStore<Model>(
  store: EnhancedStore<Model>,
  options?: AdapterOptions,
  slice?: Slice<Model>
): StoreAdapter<Model> {
  // Create a slice for state updates if not provided
  const stateSlice =
    slice ??
    createReduxSlice({
      name: 'lattice',
      initialState: store.getState(),
      reducers: {
        updateState: (state, action) => {
          Object.assign(state as any, action.payload);
        },
      },
    });

  // Track active listeners to handle edge cases
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Use provided error handler or default to console.error
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Notify all listeners with error handling
  const notifyListeners = () => {
    isNotifying = true;
    // Take a snapshot of listeners at the start of notification
    const currentListeners = Array.from(listeners);

    for (const listener of currentListeners) {
      // Don't skip listeners that were unsubscribed during this notification cycle
      // They should still be called in this cycle
      try {
        listener();
      } catch (error) {
        // Handle errors to ensure other listeners are called
        handleError(error);
      }
    }

    isNotifying = false;

    // Process pending unsubscribes after all listeners have been called
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  };

  // Subscribe to Redux store once to handle all notifications
  store.subscribe(notifyListeners);

  return {
    getState: () => store.getState() as Model,
    setState: (updates) => {
      store.dispatch(stateSlice.actions.updateState(updates));
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          // Defer unsubscribe until after current notification cycle
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { compose } = await import('@lattice/core');
  type CreateStore<State> = import('@lattice/core').CreateStore<State>;

  describe('createReduxAdapter - in-source tests', () => {
    it('should demonstrate the new API with resolve for selectors', () => {
      const createComponent = (
        createStore: CreateStore<{ count: number; multiplier: number }>
      ) => {
        const createSlice = createStore({ count: 0, multiplier: 2 });

        // Actions that mutate state
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          setMultiplier: (m: number) => set({ multiplier: m }),
        }));

        // Queries that read state
        const queries = createSlice(({ get }) => ({
          count: () => get().count,
          multiplier: () => get().multiplier,
        }));

        // Create computed views
        const computed = createSlice(({ get }) => ({
          value: () => get().count,
          doubled: () => get().count * 2,
          multiplied: () => get().count * get().multiplier,
          label: () =>
            `Count: ${get().count} (*${get().multiplier} = ${get().count * get().multiplier})`,
        }));

        return { actions, queries, computed };
      };

      const store = createReduxAdapter(createComponent);

      // Test initial state
      expect(store.computed.selector.value()).toBe(0);
      expect(store.computed.selector.doubled()).toBe(0);
      expect(store.computed.selector.multiplied()).toBe(0);
      expect(store.computed.selector.label()).toBe('Count: 0 (*2 = 0)');

      // Test actions
      store.actions.selector.increment();
      expect(store.computed.selector.value()).toBe(1);
      expect(store.computed.selector.doubled()).toBe(2);
      expect(store.computed.selector.multiplied()).toBe(2);
      expect(store.computed.selector.label()).toBe('Count: 1 (*2 = 2)');

      // Change multiplier
      store.actions.selector.setMultiplier(3);
      store.actions.selector.increment();
      expect(store.computed.selector.value()).toBe(2);
      expect(store.computed.selector.multiplied()).toBe(6);
      expect(store.computed.selector.label()).toBe('Count: 2 (*3 = 6)');
    });

    it('should work with compose for slice dependencies', () => {
      const createComponent = (
        createStore: CreateStore<{ value: number; min: number; max: number }>
      ) => {
        const createSlice = createStore({
          value: 0,
          min: 0,
          max: 100,
        });

        // Base slices
        const valueQueries = createSlice(({ get }) => ({
          current: () => get().value,
          isMin: () => get().value === get().min,
          isMax: () => get().value === get().max,
        }));

        const limitsQueries = createSlice(({ get }) => ({
          min: () => get().min,
          max: () => get().max,
          range: () => get().max - get().min,
        }));

        // Compose slices for complex actions
        const actions = createSlice(
          compose(
            { value: valueQueries, limits: limitsQueries },
            ({ set }, { value, limits }) => ({
              increment: () => {
                if (!value.isMax()) {
                  set({ value: Math.min(value.current() + 1, limits.max()) });
                }
              },
              decrement: () => {
                if (!value.isMin()) {
                  set({ value: Math.max(value.current() - 1, limits.min()) });
                }
              },
              setValue: (v: number) => {
                const clamped = Math.max(
                  limits.min(),
                  Math.min(v, limits.max())
                );
                set({ value: clamped });
              },
              setRange: (min: number, max: number) => {
                set({ min, max });
                // Clamp current value to new range
                const current = value.current();
                if (current < min) set({ value: min });
                if (current > max) set({ value: max });
              },
            })
          )
        );

        return { actions, value: valueQueries, limits: limitsQueries };
      };

      const store = createReduxAdapter(createComponent);

      // Test initial state
      expect(store.value.selector.current()).toBe(0);
      expect(store.value.selector.isMin()).toBe(true);
      expect(store.value.selector.isMax()).toBe(false);
      expect(store.limits.selector.range()).toBe(100);

      // Test bounded increment
      store.actions.selector.increment();
      expect(store.value.selector.current()).toBe(1);

      // Test setValue with clamping
      store.actions.selector.setValue(150);
      expect(store.value.selector.current()).toBe(100); // Clamped to max
      expect(store.value.selector.isMax()).toBe(true);

      store.actions.selector.setValue(-10);
      expect(store.value.selector.current()).toBe(0); // Clamped to min

      // Test range change
      store.actions.selector.setValue(50);
      store.actions.selector.setRange(10, 40);
      expect(store.value.selector.current()).toBe(40); // Clamped to new max
      expect(store.limits.selector.min()).toBe(10);
      expect(store.limits.selector.max()).toBe(40);
      expect(store.limits.selector.range()).toBe(30);
    });

    it('should support Redux middleware through enhancer', () => {
      const middlewareLog: string[] = [];

      // Custom middleware for testing
      const loggingMiddleware: Middleware = () => (next) => (action: any) => {
        middlewareLog.push(action.type);
        return next(action);
      };

      const createComponent = (createStore: CreateStore<{ count: number }>) => {
        const createSlice = createStore({ count: 0 });

        const counter = createSlice(({ get, set }) => ({
          value: () => get().count,
          increment: () => set({ count: get().count + 1 }),
        }));

        return { counter };
      };

      const store = createReduxAdapter(createComponent, (config) => {
        return configureStore({
          ...config,
          middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().concat(loggingMiddleware),
        });
      });

      // Perform actions
      store.counter.selector.increment();
      store.counter.selector.increment();

      // Check middleware was called
      expect(middlewareLog).toContain('lattice/updateState');
      expect(middlewareLog.length).toBeGreaterThan(0);
      expect(store.counter.selector.value()).toBe(2);
    });

    it('should demonstrate Redux DevTools integration pattern', () => {
      // This test shows the pattern, but DevTools won't be active in test environment
      const createComponent = (
        createStore: CreateStore<{ count: number; name: string }>
      ) => {
        const createSlice = createStore({
          count: 0,
          name: 'Redux DevTools Demo',
        });

        const component = createSlice(({ get, set }) => ({
          count: () => get().count,
          name: () => get().name,
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
        }));

        return { component };
      };

      // Example of how to use with Redux DevTools
      const store = createReduxAdapter(createComponent, (config) => {
        return configureStore({
          ...config,
          devTools: process.env.NODE_ENV !== 'production' && {
            name: 'My Lattice Component',
            trace: true,
          },
        });
      });

      // Verify store works correctly
      expect(store.component.selector.count()).toBe(0);
      store.component.selector.increment();
      expect(store.component.selector.count()).toBe(1);

      store.component.selector.setName('Updated Name');
      expect(store.component.selector.name()).toBe('Updated Name');
    });
  });
}
