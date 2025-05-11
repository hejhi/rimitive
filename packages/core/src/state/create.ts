import { STATE_FACTORY_BRAND, type StateInstance } from '../shared/types';
import type {
  RuntimeTools,
  GetState,
  StateFactory,
  DeriveFunction,
} from '../shared/types';
import { markAsLatticeState } from './identify';
import { createInstance } from '../shared/create';
import { brandWithSymbol } from '../shared';

/**
 * Marker function for state instances
 *
 * @param instance The instance to mark
 * @returns The marked instance
 */
export function stateMarker<V>(instance: V): V {
  return markAsLatticeState(instance);
}

/**
 * Creates a state instance function that serves as a blueprint for a Zustand store slice.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A state instance function that can be composed with other states
 */
export function createStateInstance<T>(
  factory: (tools: StateFactory<T>) => T
): StateInstance<T> {
  function createStateSlice(options: RuntimeTools<T>): T {
    // Ensure the required properties exist
    if (!options.get || !options.derive) {
      throw new Error('State factory requires get and derive functions');
    }

    // Call the factory with properly typed tools
    return factory(
      brandWithSymbol(
        {
          get: options.get,
          derive: options.derive,
        },
        STATE_FACTORY_BRAND
      )
    );
  }

  // The createInstance returns a BaseInstance, but we need to add the state-specific branding
  const instance = createInstance<T>(
    createStateSlice,
    markAsLatticeState,
    'state',
    createState
  );

  // Apply state-specific branding to make it a StateInstance
  return markAsLatticeState(instance);
}

/**
 * Creates a factory function for a Zustand slice.
 *
 * This is the primary API for creating states in Lattice. Use it to define your
 * state's properties and derived values. States should only access read-only data,
 * not perform mutations (which should be in models).
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterState = createState(({ get, derive }) => ({
 *   count: 0,
 *   doubleCount: () => get().count * 2,
 *   modelData: derive(counterModel, 'data'),
 *   formattedCount: () => `Count: ${get().count}`
 * }));
 *
 * // With composition
 * const extendedState = counterState.with(({ get, derive }) => ({
 *   isPositive: () => get().count > 0,
 *   specialCount: derive(counterModel, 'specialValue')
 * }));
 *
 * // Finalize for use
 * const finalState = extendedState.create();
 * ```
 *
 * @param factory A function that produces a state object with properties and derived values
 * @returns A state instance function that can be used directly with Zustand or in composition
 */
export function createState<T>(
  factory: (tools: StateFactory<T>) => T
): StateInstance<T> {
  return createStateInstance<T>(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should create a basic state with primitive values', () => {
    // Create a spy factory to check it receives the get parameter
    const factorySpy = vi.fn(() => ({
      count: 1,
    }));

    const state = createState(factorySpy);

    // State should be a function
    expect(typeof state).toBe('function');

    // The slice creator should be a function
    const sliceCreator = state();
    const mockGet: GetState<any> = vi.fn();
    const mockDerive: DeriveFunction = vi.fn();
    // Call the slice creator
    const slice = sliceCreator({ get: mockGet, derive: mockDerive });

    // Check that the factory is called with the correct parameters
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        get: mockGet,
        derive: mockDerive,
      })
    );

    // Also verify the slice contains the expected primitive value
    expect(slice).toEqual({ count: 1 });
  });

  it('should support methods in state that retrieve values', () => {
    // Create a simulated state
    const _state = { count: 1 };
    const mockGet: GetState<any> = vi.fn(() => _state);
    const mockDerive: DeriveFunction = vi.fn((model, key) => model[key]);

    // Define a type for our state
    type CounterState = {
      count: number;
      getCount: () => number;
    };

    const state = createState<CounterState>(({ get }) => ({
      count: 1,
      getCount: () => get().count,
    }));

    const sliceCreator = state();
    const slice = sliceCreator({ get: mockGet, derive: mockDerive });

    // Call the method and capture its return value
    const result = slice.getCount();

    // Verify get function was called
    expect(mockGet).toHaveBeenCalled();

    // Verify the method returned the expected value
    expect(result).toBe(1);
  });

  it('should support derived properties using get()', () => {
    // Create a simulated state that can be updated
    let _state = { count: 1 };
    const mockGet: GetState<any> = vi.fn(() => _state);

    // Define a type for our state state
    type CounterState = {
      count: number;
      doubleCount: () => number;
    };

    const state = createState<CounterState>(({ get }) => ({
      count: 1,
      doubleCount: () => get().count * 2,
    }));

    const sliceCreator = state();
    const slice = sliceCreator({
      get: mockGet,
      derive: vi.fn(),
    });

    // Test initial derived value
    expect(slice.doubleCount()).toBe(2);

    // Simulate a state change
    _state = { count: 5 };

    // Test that derived property reflects the new state
    expect(slice.doubleCount()).toBe(10);

    // Verify get() was called
    expect(mockGet).toHaveBeenCalled();
  });

  it('should support deriving values using the derive function', () => {
    // Create a mock model to derive from
    const mockModel = {
      count: 10,
      computed: 20,
    };

    // Setup the derive function
    const mockDerive: DeriveFunction = vi.fn((model, key, transform) => {
      const value = model[key];
      return transform ? transform(value) : value;
    });

    const mockGet: GetState<any> = vi.fn(() => ({ derivedCount: 5 }));

    // Define a type for our derived state
    type DerivedState = {
      derivedCount: number;
      transformedCount: number;
      combinedCount: number;
    };

    const state = createState<DerivedState>(({ get, derive }) => ({
      derivedCount: derive(mockModel, 'count'),
      transformedCount: derive(mockModel, 'count', (val) => val * 2),
      combinedCount: get().derivedCount,
    }));

    const sliceCreator = state();
    const slice = sliceCreator({ get: mockGet, derive: mockDerive });

    // Verify derive was called
    expect(mockDerive).toHaveBeenCalled();
    expect(mockDerive).toHaveBeenCalledTimes(2); // Called for each usage

    // Verify the derived values
    expect(slice.combinedCount).toBe(5);
  });
}
