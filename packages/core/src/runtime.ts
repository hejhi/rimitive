/**
 * @fileoverview Lattice runtime - connects components to adapters
 *
 * The runtime enforces the single store pattern by providing a unified
 * createStore function that manages all state through a single adapter.
 */

import type { StoreTools, StoreSliceFactory } from './index';
import {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
} from './adapter-contract';

/**
 * Function that creates a store - provided by runtime to enforce single store
 */
export type CreateStore<State> = (
  initialState: State
) => StoreSliceFactory<State>;

/**
 * Component factory receives createStore and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createStore: CreateStore<State>
) => Component;

/**
 * Runtime result - the component with subscription capability
 */
export type RuntimeResult<Component> = Component & {
  subscribe: (listener: () => void) => () => void;
  destroy?: () => void;
};

/**
 * Creates a Lattice store by connecting an component to an adapter
 *
 * This enforces the single store pattern by ensuring all state goes through
 * a single adapter instance. The createStore function provided to the component
 * factory ensures that all slices share the same state container.
 *
 * @param componentFactory - Function that creates the component, receives createStore
 * @param adapterFactory - Store adapter factory providing persistence and subscriptions
 * @returns The component with subscription capabilities
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
 * const store = createLatticeStore(createComponent, (initialState) => reduxAdapter);
 * store.counter.increment();
 * ```
 */
export function createLatticeStore<State, Component>(
  componentFactory: ComponentFactory<Component, State>,
  adapterFactory: AdapterFactory<State>
): RuntimeResult<Component> {
  // Track if createStore has been called to enforce single store
  let storeCreated = false;
  let sliceFactory: StoreSliceFactory<State> | null = null;
  let adapter: StoreAdapter<State> | undefined;

  // Create a createStore function that enforces single store pattern
  const createStore: CreateStore<any> = <S>(initialState: S) => {
    if (storeCreated) {
      throw new Error(
        'createStore can only be called once per component. ' +
          'All slices must share the same state container.'
      );
    }

    storeCreated = true;

    // Type assertion is safe here because the component factory defines the state shape
    // and the adapter is typed accordingly
    const typedInitialState = initialState as unknown as State;

    // Create the adapter with initial state
    adapter = adapterFactory(typedInitialState);

    // Create tools that use the adapter
    const tools: StoreTools<State> = {
      get: adapter.getState,
      set: adapter.setState,
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

  // Create the component with the adapter-backed createStore
  const component = componentFactory(createStore);

  // Ensure adapter was created
  if (!adapter) {
    throw new Error('Store not initialized. Call createStore first.');
  }

  // Now TypeScript knows adapter is non-null
  const finalAdapter = adapter;

  // Return the component with subscription capability
  return {
    ...component,
    subscribe: finalAdapter.subscribe,
  };
}

// Re-export for convenience
export { type StoreAdapter, isStoreAdapter };
