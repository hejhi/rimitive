// Lattice Core API - Pure state management with slices

// Export compose utilities
export { compose } from './compose';

// Export resolve utility for bound computed views
export { resolve } from './resolve';

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export runtime
export {
  createLatticeStore,
  type RuntimeResult,
  type ComponentFactory,
  type CreateStore,
} from './runtime';

// Export adapter contract
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';

// Export subscription utilities
export {
  subscribeToSlices,
  shallowEqual,
  injectStartTransition,
  type SubscribableStore,
  type SubscribeOptions,
} from './subscribe';

// Import types needed for interfaces
import type { StoreAdapter as Adapter } from './adapter-contract';

// New createStore API types
export interface StoreTools<State> {
  get: () => State;
  set: (updates: Partial<State>) => void;
}

/**
 * A Lattice slice with methods, subscription, and composition capabilities
 */
export interface LatticeSlice<Methods, State> {
  selector: Methods;
  subscribe: (listener: () => void) => () => void;
  compose: (tools: StoreTools<State>) => LatticeSlice<Methods, State>;
  adapter: Adapter<State>;
}

// Type for runtime slice factory that returns full LatticeSlice
export type RuntimeSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => LatticeSlice<Methods, State>;

// Type for standalone slice factory that returns just methods
export type StoreSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => Methods;

/**
 * Factory function that creates a slice factory when provided with tools.
 * This is used internally by the runtime to create adapter-backed stores.
 */
export type StoreFactory<State> = (
  tools: StoreTools<State>
) => StoreSliceFactory<State>;

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
 * const counter = createSlice(({ get, set }) => ({
 *   count: () => get().count,
 *   increment: () => set({ count: get().count + 1 })
 * }));
 * ```
 */
export function createStore<State>(
  initialState: State
): StoreSliceFactory<State> {
  // Create tools that will be shared across all slices
  const tools: StoreTools<State> = {
    get: () => initialState,
    set: (updates: Partial<State>) => {
      initialState = { ...initialState, ...updates };
    },
  };

  // Return the slice factory function
  return function createSlice<Methods>(
    factory: (tools: StoreTools<State>) => Methods
  ): Methods {
    return factory(tools);
  };
}
