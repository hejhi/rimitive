import type { ModelFactory, ModelInstance, GetState, SetState } from './types';
import type { Factory } from '../shared/types';
import { markAsLatticeModel } from './identify';
import {
  createInstance,
  createSliceCreator as sharedCreateSliceCreator,
} from '../shared/create';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param options Object containing get and set functions
 * @returns A state object with properties, methods, and derived values
 */
export function createSliceCreator<T>(
  factory: (tools: ModelFactory<T>) => T,
  options: Factory<T>
): T {
  // Check if required properties exist
  if (!options.get || !options.set) {
    throw new Error('Model factory requires get and set functions');
  }

  // Create model tools with proper branding
  const tools: ModelFactory<T> = {
    get: options.get,
    set: options.set,
    __modelFactoryBrand: Symbol('model')
  } as ModelFactory<T>;

  // Pass to shared createSliceCreator
  return sharedCreateSliceCreator(factory as (tools: Factory<T>) => T, tools);
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
  // Convert the factory to accept the shared Factory type
  const factoryAdapter = (tools: Factory<T>): T => {
    // Cast the tools to ModelFactory to ensure type safety
    const modelTools = tools as unknown as ModelFactory<T>;
    return factory(modelTools);
  };

  return createInstance<T, unknown>(
    factoryAdapter,
    modelMarker,
    'model',
    createModel
  ) as ModelInstance<T>;
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
    const slice = sliceCreator({ get: mockGet, set: mockSet }) as CounterState;

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
    const slice = sliceCreator({
      get: mockGet,
      set: vi.fn() as SetState<CounterState>,
    }) as CounterState;

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
