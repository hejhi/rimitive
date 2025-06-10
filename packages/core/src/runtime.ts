/**
 * @fileoverview Lattice runtime - connects apps to adapters
 *
 * The runtime enforces the single store pattern by providing a unified
 * createStore function that manages all state through a single adapter.
 */

import type { StoreTools, StoreSliceFactory } from './index';
import { type StoreAdapter, isStoreAdapter } from './adapter-contract';

/**
 * Function that creates a store - provided by runtime to enforce single store
 */
export type CreateStore = <State>(
  initialState: State
) => StoreSliceFactory<State>;

/**
 * App factory receives createStore and returns the app's slices
 */
export type AppFactory<App> = (createStore: CreateStore) => App;

/**
 * Runtime result - the app with subscription capability
 */
export type RuntimeResult<App> = App & {
  subscribe: (listener: () => void) => () => void;
  destroy?: () => void;
};

/**
 * Creates a Lattice store by connecting an app to an adapter
 *
 * This enforces the single store pattern by ensuring all state goes through
 * a single adapter instance. The createStore function provided to the app
 * factory ensures that all slices share the same state container.
 *
 * @param appFactory - Function that creates the app, receives createStore
 * @param adapter - Store adapter providing persistence and subscriptions
 * @returns The app with subscription capabilities
 *
 * @example
 * ```typescript
 * const createApp = (createStore: CreateStore) => {
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
 * const store = createLatticeStore(createApp, reduxAdapter);
 * store.counter.increment();
 * ```
 */
export function createLatticeStore<State, App>(
  appFactory: AppFactory<App>,
  adapter: StoreAdapter<State>
): RuntimeResult<App> {
  // Track if createStore has been called to enforce single store
  let storeCreated = false;
  let sliceFactory: StoreSliceFactory<State> | null = null;

  // Create a createStore function that enforces single store pattern
  const createStore: CreateStore = <S>(initialState: S) => {
    if (storeCreated) {
      throw new Error(
        'createStore can only be called once per app. ' +
        'All slices must share the same state container.'
      );
    }
    
    storeCreated = true;
    
    // Type assertion is safe here because the app factory defines the state shape
    // and the adapter is typed accordingly
    const typedInitialState = initialState as unknown as State;
    const typedAdapter = adapter;
    
    // Initialize adapter with the initial state
    typedAdapter.setState(typedInitialState);

    // Create tools that use the adapter
    const tools: StoreTools<State> = {
      get: typedAdapter.getState,
      set: typedAdapter.setState,
    };

    // Create and store the slice factory
    sliceFactory = function createSlice<Methods>(
      factory: (tools: StoreTools<State>) => Methods
    ): Methods {
      return factory(tools);
    };
    
    // Return the slice factory with the original type
    return sliceFactory as unknown as StoreSliceFactory<S>;
  };

  // Create the app with the adapter-backed createStore
  const app = appFactory(createStore);

  // Return the app with subscription capability
  return {
    ...app,
    subscribe: adapter.subscribe,
  };
}

// Re-export for convenience
export { type StoreAdapter, isStoreAdapter };
