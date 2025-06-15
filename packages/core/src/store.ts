// Standalone store implementation without runtime dependencies

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