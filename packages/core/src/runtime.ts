/**
 * @fileoverview Lattice runtime - connects components to adapters
 *
 * The runtime enforces the single store pattern by providing a unified
 * createStore function that manages all state through a single adapter.
 */

import type { StoreTools, RuntimeSliceFactory, LatticeSlice } from './index';
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
) => RuntimeSliceFactory<State>;

/**
 * Component factory receives createStore and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createStore: CreateStore<State>
) => Component;

/**
 * Runtime result - the component
 */
export type RuntimeResult<Component> = Component;

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
 * store.counter.selector.increment();
 * ```
 */
export function createLatticeStore<State, Component>(
  componentFactory: ComponentFactory<Component, State>,
  adapterFactory: AdapterFactory<State>
): RuntimeResult<Component> {
  // Track if createStore has been called to enforce single store
  let storeCreated = false;

  // Create a createStore function that enforces single store pattern
  const createStore: CreateStore<any> = (initialState: State) => {
    if (storeCreated) {
      throw new Error(
        'createStore can only be called once per component. ' +
          'All slices must share the same state container.'
      );
    }

    storeCreated = true;
    // Create the adapter with initial state
    const adapter = adapterFactory(initialState);

    // Create tools that use the adapter
    const tools: StoreTools<State> = {
      get: adapter.getState,
      set: adapter.setState,
    };

    function composeSlice(
      adapter: StoreAdapter<State>,
      tools: StoreTools<State>
    ): RuntimeSliceFactory<State> {
      // Create and store the slice factory
      return function createSlice<Methods>(
        factory: (tools: StoreTools<State>) => Methods
      ): LatticeSlice<Methods, State> {
        const methods = factory(tools);
        return {
          selector: methods,
          subscribe: adapter.subscribe,
          compose: (newTools: StoreTools<State>) => {
            // Create a new slice with the new tools
            const newSlice = composeSlice(adapter, newTools);
            return newSlice(factory);
          },
          adapter,
        };
      };
    }

    // Return the slice factory with the original type
    return composeSlice(adapter, tools);
  };

  // Return the component with subscription capability
  return componentFactory(createStore);
}

// Re-export for convenience
export { type StoreAdapter, isStoreAdapter };
