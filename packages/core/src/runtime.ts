/**
 * @fileoverview Lattice runtime - connects components to adapters
 *
 * The runtime enforces the single store pattern by providing a unified
 * createStore function that manages all state through a single adapter.
 */

import type { StoreTools, RuntimeSliceFactory, LatticeSlice } from './index';
import {
  type StoreAdapter,
  isStoreAdapter,
} from './adapter-contract';

/**
 * Component factory receives slice factory and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createSlice: RuntimeSliceFactory<State>
) => Component;

/**
 * Creates a Lattice slice factory from a store adapter.
 *
 * This is a simple utility that wraps an adapter with slice creation logic.
 * Each adapter can call this internally to create their slice factory.
 *
 * @param adapter - The store adapter providing state management
 * @returns A slice factory that creates slices with the adapter
 *
 * @example
 * ```typescript
 * // Inside an adapter's createStore function:
 * const adapter = createAdapter(state);
 * return createLatticeStore(adapter);
 * ```
 */
export function createLatticeStore<State>(
  adapter: StoreAdapter<State>
): RuntimeSliceFactory<State> {
  // Create tools that use the adapter
  const tools: StoreTools<State> = {
    get: adapter.getState,
    set: adapter.setState,
  };

  // Create and return the slice factory
  return function createSlice<Methods>(
    factory: (tools: StoreTools<State>) => Methods
  ): LatticeSlice<Methods, State> {
    const methods = factory(tools);
    return {
      selector: methods,
      subscribe: adapter.subscribe,
      compose: (newTools: StoreTools<State>) => {
        // Create a new slice with the new tools
        const newMethods = factory(newTools);
        return {
          selector: newMethods,
          subscribe: adapter.subscribe,
          compose: (newerTools: StoreTools<State>) => {
            return createSlice(factory).compose(newerTools);
          },
          adapter,
        };
      },
      adapter,
    };
  };
}

// Re-export for convenience
export { type StoreAdapter, isStoreAdapter };
export type { RuntimeSliceFactory } from './index';
