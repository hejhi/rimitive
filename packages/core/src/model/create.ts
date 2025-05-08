import type {
  ModelFactory,
  ModelInstance,
  SliceCreator,
  GetState,
  SetState,
  FinalizedModel,
} from './types';
import { markAsLatticeModel } from './identify';
import { validateModel } from './validation';
import { createComposedModelInstance } from './compose';

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
  return factory({ get, set });
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
  const modelInstance = function modelInstance(): SliceCreator<T> {
    return function sliceCreator(set: SetState<T>, get: GetState<T>) {
      return createSliceCreator<T>(factory, set, get);
    };
  };

  // Add the .with() method for fluent composition
  modelInstance.with = function with_<U>(
    extensionFactory: (tools: ModelFactory<any>) => U
  ): ModelInstance<any> {
    // Create a new model from the extension factory
    const extensionModel = createModel<U>((tools) => {
      // We need to explicitly annotate tools with any here because of TypeScript's limitations
      // with modeling the cross-model property access
      return extensionFactory(tools as any);
    });

    // Compose the current model with the extension model
    return createComposedModelInstance(modelInstance, extensionModel);
  };

  // Add the .create() method for model finalization
  modelInstance.create = function create(): FinalizedModel<T> {
    // Validate model for circular references before finalizing
    validateModel(modelInstance);

    // Create a finalized model that contains the same slice creator
    const finalizedModel = function finalizedModel(): SliceCreator<T> {
      return modelInstance();
    };

    // Mark as finalized
    Object.defineProperty(finalizedModel, '__finalized', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    // Add a .with() method that throws when called to provide a clear error message
    // This ensures runtime safety in addition to compile-time safety
    (finalizedModel as any).with = function withAfterFinalization() {
      throw new Error('Cannot compose a finalized model');
    };

    return finalizedModel as FinalizedModel<T>;
  };

  // Mark this as a valid Lattice model
  return markAsLatticeModel(modelInstance);
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
