/**
 * @fileoverview store-react adapter for Lattice
 *
 * This adapter provides integration with store-react for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

// Internal store API type (previously from @lattice/store/react)
interface StoreReactApi<T> {
  getState: () => T;
  setState: (updates: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
  destroy?: () => void;
}
import type { StoreAdapter } from '@lattice/core';

type StoreCreator<T> = (set: (partial: Partial<T>) => void, get: () => T) => T;

/**
 * Configuration options for store-react adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows customization of store creation
 *
 * @param stateCreator - Function that returns the initial state
 * @param createStore - Function to create the store with the state creator
 * @returns Enhanced store instance
 */
export type StoreEnhancer<State> = (
  stateCreator: StoreCreator<State>,
  createStore: (creator: StoreCreator<State>) => StoreReactApi<State>
) => StoreReactApi<State>;

/**
 * Creates a Lattice adapter using store-react for state management.
 *
 * @param initialState - The initial state for the store
 * @param options - Optional configuration including enhancer
 * @returns A StoreAdapter for use with Lattice components
 *
 * @example
 * ```typescript
 * import { createStore } from '@lattice/adapter-store-react';
 * import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';
 *
 * const adapter = createStore({ count: 0 });
 *
 * const Counter = createComponent(
 *   withState<{ count: number }>(),
 *   ({ store, set }) => ({
 *     count: store.count,
 *     increment: () => set({ count: store.count() + 1 })
 *   })
 * );
 *
 * const counter = createStoreWithAdapter(Counter, adapter);
 * counter.increment();
 * ```
 */
export function createStore<State>(
  initialState: State,
  options?: AdapterOptions & { enhancer?: StoreEnhancer<State> }
): StoreAdapter<State> {
  // Create a store creator function that returns the initial state
  const stateCreator: StoreCreator<State> = () => initialState;

  // Create the store using our custom creation function
  const store = createStoreReactStore(stateCreator, options?.enhancer);

  return wrapStoreReact(store, options);
}

/**
 * Creates a store-react adapter for a Lattice component.
 *
 * @deprecated Use createStore instead for the new adapter-first API
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for customization
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by store-react
 */
export function createStoreReactAdapter<Component, State>(
  componentFactory: (
    createStore: (initialState: State) => StoreAdapter<State>
  ) => Component,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  // For backwards compatibility, create a function that mimics the old API
  const createStoreFunction = (initialState: State) => {
    return createStore(initialState, { ...options, enhancer });
  };

  return componentFactory(createStoreFunction);
}

/**
 * Creates a store-react store outside of React components
 *
 * Since store-react is designed for component-scoped state, we need to
 * create a store manually using its internal API structure.
 *
 * @param stateCreator - Function that creates the initial state
 * @param enhancer - Optional store enhancer
 * @returns A store-react store instance
 */
function createStoreReactStore<State>(
  stateCreator: StoreCreator<State>,
  enhancer?: StoreEnhancer<State>
): StoreReactApi<State> {
  // Create the basic store structure
  const listeners = new Set<() => void>();
  let state: State;

  // Create the store API
  const api: StoreReactApi<State> = {
    getState: () => state,
    setState: (updates: Partial<State> | ((state: State) => Partial<State>)) => {
      const partial = typeof updates === 'function' ? updates(state) : updates;

      // Always update state and notify (store-react pattern)
      state = { ...state, ...partial };

      // Notify all listeners - use Array.from to handle concurrent modifications
      const currentListeners = Array.from(listeners);
      for (const listener of currentListeners) {
        try {
          listener();
        } catch (error) {
          // In production, errors are silent to avoid breaking other listeners
          if (process.env.NODE_ENV !== 'production') {
            console.error('Error in store listener:', error);
          }
        }
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: () => {
      listeners.clear();
    },
  };

  // Initialize the state using the creator function
  state = stateCreator(api.setState, api.getState);

  // Apply enhancer if provided
  if (enhancer) {
    const createStore = (creator: StoreCreator<State>) => {
      const newApi = { ...api };
      const newState = creator(newApi.setState, newApi.getState);
      state = newState;
      return newApi;
    };

    return enhancer(stateCreator, createStore);
  }

  return api;
}

/**
 * Wraps an existing store-react store as a minimal adapter
 *
 * This allows you to use an existing store-react store with Lattice.
 *
 * @param store - An existing store-react store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 *
 * @example
 * ```typescript
 * const storeReactStore = createStoreReactStore(...);
 * const adapter = wrapStoreReact(storeReactStore);
 * const store = createLatticeStore(component, adapter);
 * ```
 */
export function wrapStoreReact<State>(
  store: StoreReactApi<State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Simple pass-through adapter
  // The store already handles all the notification logic

  if (options?.onError) {
    // Only wrap if custom error handler is provided
    return {
      getState: store.getState,
      setState: store.setState,
      subscribe: (listener) => {
        const wrappedListener = () => {
          try {
            listener();
          } catch (error) {
            options.onError!(error);
          }
        };
        return store.subscribe(wrappedListener);
      },
    };
  }

  // Direct pass-through when no error handler
  return {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
  };
}

/**
 * Creates a minimal adapter using store-react's core API
 *
 * This creates a new store-react compatible store with minimal wrapping.
 * Similar to createStoreAdapter but works directly with the state.
 *
 * @param options - Optional configuration for the adapter
 * @returns A store adapter factory
 */
export function createStoreAdapter<State>(
  options?: AdapterOptions
): (initialState: State) => StoreAdapter<State> {
  return (initialState: State) => {
    const stateCreator: StoreCreator<State> = () => initialState;
    const store = createStoreReactStore(stateCreator);
    return wrapStoreReact(store, options);
  };
}
