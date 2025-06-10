/**
 * @fileoverview Lattice runtime - connects apps to adapters
 *
 * The runtime provides adapter-backed versions of createStore to apps,
 * enabling persistence and subscription capabilities.
 */

import type { StoreTools, StoreSliceFactory } from './index';

/**
 * Minimal adapter interface - adapters only need to provide store primitives
 */
export interface StoreAdapter<State> {
  getState: () => State;
  setState: (updates: Partial<State>) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Function that creates a store - can be provided by runtime or imported from core
 */
export type CreateStore = <State>(initialState: State) => StoreSliceFactory<State>;

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
 * Creates an adapter-backed version of createStore
 * 
 * @param initialState - The initial state shape
 * @param adapter - The adapter providing persistence
 * @returns A createSlice factory connected to the adapter
 */
function createAdapterStore<State>(
  initialState: State,
  adapter: StoreAdapter<State>
): StoreSliceFactory<State> {
  // Initialize adapter with the initial state
  adapter.setState(initialState);
  
  // Create tools that use the adapter
  const tools: StoreTools<State> = {
    get: adapter.getState,
    set: adapter.setState,
  };
  
  // Return the slice factory function
  return function createSlice<Methods>(
    factory: (tools: StoreTools<State>) => Methods
  ): Methods {
    return factory(tools);
  };
}

/**
 * Creates a Lattice store by connecting an app to an adapter
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
  // Create an adapter-backed createStore function
  const createStore: CreateStore = <S>(initialState: S) => {
    // For now, we assume single store per app
    // Cast is safe because app factory defines the state type
    return createAdapterStore(initialState, adapter as unknown as StoreAdapter<S>);
  };
  
  // Create the app with the adapter-backed createStore
  const app = appFactory(createStore);
  
  // Return the app with subscription capability
  return {
    ...app,
    subscribe: adapter.subscribe,
  } as RuntimeResult<App>;
}

/**
 * Type guard to check if a value is a store adapter
 */
export function isStoreAdapter<State>(
  value: unknown
): value is StoreAdapter<State> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getState' in value &&
    'setState' in value &&
    'subscribe' in value &&
    typeof (value as any).getState === 'function' &&
    typeof (value as any).setState === 'function' &&
    typeof (value as any).subscribe === 'function'
  );
}
