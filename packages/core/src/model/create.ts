import type { ModelFactory, ModelInstance, GetState, SetState } from './types';
import { markAsLatticeModel } from './identify';
import {
  createInstance,
  createSliceCreator as sharedCreateSliceCreator,
} from '../shared/create';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param set The Zustand set function for updating state
 * @param get The Zustand get function for accessing current state
 * @returns A state object with properties, methods, and derived values
 */
export function createSliceCreator<T>(
  factory: (tools: ModelFactory<T>) => T,
  set: SetState<T>,
  get: GetState<T>
): T {
  return sharedCreateSliceCreator(factory, set, get);
}

/**
 * Marker function for model instances
 *
 * @param instance The instance to mark
 * @returns The marked instance
 */
export function modelMarker<V>(instance: V): V {
  return markAsLatticeModel(instance);
}

/**
 * Creates a model instance function that serves as a blueprint for a Zustand store slice.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A model instance function that can be composed with other models
 */
export function createModelInstance<T>(
  factory: (tools: ModelFactory<T>) => T
): ModelInstance<T> {
  return createInstance<T, unknown>(factory, modelMarker, 'model', createModel);
}

/**
 * Creates a factory function for a Zustand slice.
 *
 * This is the primary API for creating models in Lattice. Use it to define your
 * model's state, actions, and derived values.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterModel = createModel(({ get, set }) => ({
 *   count: 0,
 *   increment: () => set(state => ({ count: state.count + 1 })),
 *   decrement: () => set(state => ({ count: state.count - 1 })),
 *   reset: () => set({ count: 0 }),
 *   doubleCount: () => get().count * 2
 * }));
 *
 * // With composition
 * const extendedModel = counterModel.with(({ get, set }) => ({
 *   triple: () => set(state => ({ count: state.count * 3 })),
 *   isPositive: () => get().count > 0
 * }));
 *
 * // Finalize for use
 * const finalModel = extendedModel.create();
 * ```
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A model instance function that can be used directly with Zustand or in composition
 */
export function createModel<T>(
  factory: (tools: ModelFactory<T>) => T
): ModelInstance<T> {
  return createModelInstance<T>(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should create a basic model with primitive values', () => {
    // Create a spy factory to check it receives the get parameter
    const factorySpy = vi.fn(() => ({
      count: 1,
    }));

    const model = createModel(factorySpy);

    // Model should be a function
    expect(typeof model).toBe('function');

    // The slice creator should be a function
    const sliceCreator = model();
    const mockSet = vi.fn() as SetState<any>;
    const mockGet = vi.fn() as GetState<any>;

    // Call the slice creator
    const slice = sliceCreator(mockSet, mockGet);

    // Check that the factory is called with the correct parameters
    expect(factorySpy).toHaveBeenCalledWith({ get: mockGet, set: mockSet });

    // Also verify the slice contains the expected primitive value
    expect(slice).toEqual({ count: 1 });
  });

  it('should support methods in model state', () => {
    // Create a simulated state that tracks changes
    let state = { count: 1 };
    const mockSet = vi.fn((updater: ((state: any) => any) | any) => {
      if (typeof updater === 'function') {
        state = { ...state, ...updater(state) };
      } else {
        state = { ...state, ...updater };
      }
    }) as SetState<any>;
    const mockGet = vi.fn(() => state) as GetState<any>;

    // Define a type for our model state
    type CounterState = {
      count: number;
      increment: () => number;
    };

    const model = createModel<CounterState>(({ get, set }) => ({
      count: 1,
      increment: () => {
        set((state: CounterState) => ({ count: state.count + 1 }));
        return get().count;
      },
    }));

    const sliceCreator = model();
    const slice = sliceCreator(mockSet, mockGet) as CounterState;

    // Call the method and capture its return value
    const result = slice.increment();

    // Verify the set function was called
    expect(mockSet).toHaveBeenCalled();

    // Verify the state was actually updated
    expect(state.count).toBe(2);

    // Verify the method returned the updated value
    expect(result).toBe(2);
  });

  it('should support derived properties using get()', () => {
    // Create a simulated state that can be updated
    let state = { count: 1 };
    const mockGet = vi.fn(() => state) as GetState<any>;

    // Define a type for our model state
    type CounterState = {
      count: number;
      doubleCount: () => number;
    };

    const model = createModel<CounterState>(({ get }) => ({
      count: 1,
      doubleCount: () => get().count * 2,
    }));

    const sliceCreator = model();
    const slice = sliceCreator(
      vi.fn() as SetState<CounterState>,
      mockGet
    ) as CounterState;

    // Test initial derived value
    expect(slice.doubleCount()).toBe(2);

    // Simulate a state change
    state = { count: 5 };

    // Test that derived property reflects the new state
    expect(slice.doubleCount()).toBe(10);

    // Verify get() was called
    expect(mockGet).toHaveBeenCalled();
  });
}
