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
  type Slice,
} from '@reduxjs/toolkit';
import type { StoreAdapter, RuntimeSliceFactory } from '@lattice/core';
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
 * Creates a Lattice store using Redux for state management.
 *
 * @param initialState - The initial state for the store
 * @param options - Optional configuration including middleware enhancer
 * @returns A RuntimeSliceFactory for creating slices
 *
 * @example
 * ```typescript
 * import { createStore } from '@lattice/adapter-redux';
 *
 * const createSlice = createStore({ count: 0 });
 *
 * const createComponent = (createSlice) => {
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const component = createComponent(createSlice);
 * component.counter.selector.increment();
 * ```
 *
 * @example With middleware
 * ```typescript
 * import { devToolsEnhancer } from '@redux-devtools/extension';
 *
 * const createSlice = createStore(
 *   { count: 0 },
 *   {
 *     enhancer: (config) => configureStore({
 *       ...config,
 *       enhancers: [devToolsEnhancer()]
 *     })
 *   }
 * );
 * ```
 */
export function createStore<State>(
  initialState: State,
  options?: AdapterOptions & { enhancer?: StoreEnhancer<State> }
): RuntimeSliceFactory<State> {
  // Create adapter with initial state and optional enhancer
  const adapter = options?.enhancer
    ? createStoreAdapter(options.enhancer, options)
    : createStoreAdapter(initialState, options);

  // If we used an enhancer, set the initial state
  if (options?.enhancer) {
    adapter.setState(initialState);
  }

  // Return the slice factory
  return createLatticeStore(adapter);
}

/**
 * Creates a Redux adapter for a Lattice component.
 *
 * @deprecated Use createStore instead for the new adapter-first API
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Redux
 */
export function createReduxAdapter<Component>(
  componentFactory: (
    createStore: (initialState: any) => RuntimeSliceFactory<any>
  ) => Component,
  enhancer?: StoreEnhancer<any>,
  options?: AdapterOptions
): Component {
  // For backwards compatibility, create a function that mimics the old API
  const createStoreFunction = (initialState: any) => {
    return createStore(initialState, { ...options, enhancer });
  };

  return componentFactory(createStoreFunction);
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
