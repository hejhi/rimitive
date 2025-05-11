import { STATE_FACTORY_BRAND } from '../shared/types';
import { markAsLatticeState } from './identify';
import { createInstance } from '../shared/create';
import { brandWithSymbol } from '../shared';

/**
 * Marker function for state instances
 *
 * @param instance The instance to mark
 * @returns The marked instance
 */
export function stateMarker(instance) {
  return markAsLatticeState(instance);
}

/**
 * Creates a state instance function that serves as a blueprint for a Zustand store slice.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A state instance function that can be composed with other states
 */
export function createStateInstance(factory) {
  function createStateSlice(options) {
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
  const instance = createInstance(
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
export function createState(factory) {
  return createStateInstance(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should verify state factory requirements and branding', async () => {
    // Create a spy factory
    const factorySpy = vi.fn(() => ({
      count: 1,
    }));

    const state = createState(factorySpy);

    // State should be a function
    expect(typeof state).toBe('function');

    // Should have lattice state branding
    const { isStateInstance } = await import('../shared/identify');
    expect(isStateInstance(state)).toBe(true);

    // Should have the expected API (.with and .create methods)
    expect(typeof state.with).toBe('function');
    expect(typeof state.create).toBe('function');

    // Create tools for testing
    const mockGet = vi.fn();
    const mockDerive = vi.fn();

    // Create a slice with the mock tools
    const sliceCreator = state();
    const slice = sliceCreator({ get: mockGet, derive: mockDerive });

    // Factory should be called with the tools
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        get: mockGet,
        derive: mockDerive,
      })
    );

    // The tools should be branded with the proper symbol
    const { isStateFactory } = await import('../shared/identify');
    const toolsObj = factorySpy.mock.calls[0]?.[0];
    expect(isStateFactory(toolsObj)).toBe(true);

    // Verify slice contains the expected value
    expect(slice).toEqual({ count: 1 });
  });

  it('should throw an error when required tools are missing', () => {
    const state = createState(() => ({ count: 1 }));
    const sliceCreator = state();

    // Should throw when get or derive are missing
    expect(() => sliceCreator({})).toThrow(
      'State factory requires get and derive functions'
    );
    expect(() => sliceCreator({ get: undefined, derive: vi.fn() })).toThrow(
      'State factory requires get and derive functions'
    );
    expect(() => sliceCreator({ get: vi.fn(), derive: undefined })).toThrow(
      'State factory requires get and derive functions'
    );
  });

  it('should support deriving values using the derive function', () => {
    // Create a mock model to derive from
    const mockModel = {
      count: 10,
      computed: 20,
    };

    // Setup the derive function
    const mockDerive = vi.fn((model, key, transform) => {
      const value = model[key];
      return transform ? transform(value) : value;
    });

    const mockGet = vi.fn(() => ({ derivedCount: 5 }));

    const state = createState(({ get, derive }) => ({
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
