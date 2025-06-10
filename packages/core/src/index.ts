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
  type StoreAdapter,
  type RuntimeResult,
  type AppFactory,
  type CreateStore,
} from './runtime';

// New createStore API types
export interface StoreTools<State> {
  get: () => State;
  set: (updates: Partial<State>) => void;
}

export type StoreSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => Methods;

/**
 * Creates a store with pure serializable state and returns a slice factory.
 * This is the new primary API that separates state from behaviors.
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
  // Create a mutable state container
  let state = { ...initialState };
  
  // Create tools that will be shared across all slices
  const tools: StoreTools<State> = {
    get: () => state,
    set: (updates: Partial<State>) => {
      state = { ...state, ...updates };
    }
  };
  
  // Return the slice factory function
  return function createSlice<Methods>(
    factory: (tools: StoreTools<State>) => Methods
  ): Methods {
    return factory(tools);
  };
}

