import type { StateFactory, StateInstance, GetState, SetState } from './types';
import type { Factory } from '../shared/types';
import { markAsLatticeState } from './identify';
import {
  createInstance,
  createSliceCreator as sharedCreateSliceCreator,
} from '../shared/create';

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
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param options Object containing get and set functions
 * @returns A state object with properties, methods, and derived values
 */
export function createSliceCreator<T>(
  factory: (tools: StateFactory<T>) => T,
  options: Factory<T>
): T {
  // Check if get is provided, which is required for state
  if (!options.get) {
    throw new Error('State factory requires a get function');
  }

  // Create state tools with proper branding
  const tools: StateFactory<T> = {
    get: options.get,
    set: options.set,
    derive: options.derive || ((model: any, key: any) => model[key]), // Simple derive implementation
    __stateFactoryBrand: Symbol('state'),
  } as StateFactory<T>;

  // Pass to shared createSliceCreator
  return sharedCreateSliceCreator(factory as (tools: Factory<T>) => T, tools);
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
  // Convert the factory to accept the shared Factory type
  const factoryAdapter = (tools: Factory<T>): T => {
    // Cast the tools to StateFactory to ensure type safety
    const stateTools = tools as unknown as StateFactory<T>;
    return factory(stateTools);
  };

  return createInstance<T, unknown>(
    factoryAdapter,
    stateMarker,
    'state',
    createState
  ) as StateInstance<T>;
}

/**
 * Creates a factory function for a Zustand slice.
 *
 * This is the primary API for creating states in Lattice. Use it to define your
 * state's state, actions, and derived values.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterState = createState(({ get, set }) => ({
 *   count: 0,
 *   increment: () => set(state => ({ count: state.count + 1 })),
 *   decrement: () => set(state => ({ count: state.count - 1 })),
 *   reset: () => set({ count: 0 }),
 *   doubleCount: () => get().count * 2
 * }));
 *
 * // With composition
 * const extendedState = counterState.with(({ get, set }) => ({
 *   triple: () => set(state => ({ count: state.count * 3 })),
 *   isPositive: () => get().count > 0
 * }));
 *
 * // Finalize for use
 * const finalState = extendedState.create();
 * ```
 *
 * @param factory A function that produces a state object with optional methods and derived properties
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
    const mockSet = vi.fn() as SetState<any>;
    const mockGet = vi.fn() as GetState<any>;

    // Call the slice creator
    const slice = sliceCreator({ get: mockGet, set: mockSet });

    // Check that the factory is called with the correct parameters
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        get: mockGet,
        set: mockSet,
      })
    );

    // Also verify the slice contains the expected primitive value
    expect(slice).toEqual({ count: 1 });
  });

  it('should support methods in state state', () => {
    // Create a simulated state that tracks changes
    let _state = { count: 1 };
    const mockSet = vi.fn((updater: ((state: any) => any) | any) => {
      if (typeof updater === 'function') {
        _state = { ..._state, ...updater(_state) };
      } else {
        _state = { ..._state, ...updater };
      }
    }) as SetState<any>;
    const mockGet = vi.fn(() => _state) as GetState<any>;

    // Define a type for our state state
    type CounterState = {
      count: number;
      increment: () => number;
    };

    const state = createState<CounterState>(({ get, set }) => ({
      count: 1,
      increment: () => {
        set!((state: CounterState) => ({ count: state.count + 1 }));
        return get!().count;
      },
    }));

    const sliceCreator = state();
    const slice = sliceCreator({ get: mockGet, set: mockSet }) as CounterState;

    // Call the method and capture its return value
    const result = slice.increment();

    // Verify the set function was called
    expect(mockSet).toHaveBeenCalled();

    // Verify the state was actually updated
    expect(_state.count).toBe(2);

    // Verify the method returned the updated value
    expect(result).toBe(2);
  });

  it('should support derived properties using get()', () => {
    // Create a simulated state that can be updated
    let _state = { count: 1 };
    const mockGet = vi.fn(() => _state) as GetState<any>;

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
      set: vi.fn() as SetState<CounterState>,
    }) as CounterState;

    // Test initial derived value
    expect(slice.doubleCount()).toBe(2);

    // Simulate a state change
    _state = { count: 5 };

    // Test that derived property reflects the new state
    expect(slice.doubleCount()).toBe(10);

    // Verify get() was called
    expect(mockGet).toHaveBeenCalled();
  });

  // TODO: This test will be implemented when the derive functionality is added
  // Commenting out for now to avoid TypeScript errors
  /*
  it('should add derive() helper to StateFactory tools for finalized model references', () => {
    // Create a finalized model to derive from
    const counterModel = createModel(() => ({
      count: 10,
      getDoubleCount: () => 20, // Simplified for testing
    })).create();

    // The types are needed for TypeScript
    type DerivedState = {
      derivedCount: number;
    };

    // This test will be implemented when the derive functionality is added
    // Skip for now
  });
  */
}
