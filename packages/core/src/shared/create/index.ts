import type {
  Factory,
  Instance,
  SliceCreator,
  GetState,
  SetState,
  Finalized,
} from '../types';
import { finalizeInstance } from '../validation';
import { createComposedInstance } from '../compose';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param set The Zustand set function for updating state
 * @param get The Zustand get function for accessing current state
 * @returns A state object with properties, methods, and derived values
 */
export function createSliceCreator<T>(
  factory: (tools: Factory<T>) => T,
  set: SetState<T>,
  get: GetState<T>
): T {
  return factory({ get, set });
}

/**
 * Creates an instance function that serves as a blueprint.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param markerFn Function to mark the instance as a valid entity
 * @param entityName Name of the entity (model, state, etc.) for error messages
 * @returns An instance function that can be composed with other instances
 */
export function createInstance<T, F>(
  factory: (tools: Factory<T>) => T,
  markerFn: <V>(instance: V) => V,
  entityName: string,
  createEntityFn: <U>(factory: (tools: Factory<U>) => U) => Instance<U, F>
): Instance<T, F> {
  const instance = function instance(): SliceCreator<T> {
    return function sliceCreator(set: SetState<T>, get: GetState<T>) {
      return createSliceCreator<T>(factory, set, get);
    };
  };

  // Add the .with() method for fluent composition
  instance.with = function with_<U>(
    extensionFactory: (tools: Factory<any>) => U
  ): Instance<any, F> {
    // Create a new instance from the extension factory
    const extensionInstance = createEntityFn<U>((tools) => {
      // We need to explicitly annotate tools with any here because of TypeScript's limitations
      // with modeling the cross-instance property access
      return extensionFactory(tools);
    });

    // Compose the current instance with the extension instance
    return createComposedInstance(
      instance,
      extensionInstance,
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  instance.create = function create(): Finalized<T> {
    // Validate instance for circular references before finalizing
    return finalizeInstance(instance, entityName);
  };

  // Mark this as a valid Lattice instance
  return markerFn(instance);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createInstance', () => {
    // Create test doubles for dependencies
    const testMarkerFn = <T>(value: T): T => value;

    const testCreateEntityFn = <T>(
      factory: (tools: Factory<T>) => T
    ): Instance<T, unknown> => {
      const instance = function instance(): SliceCreator<T> {
        return function sliceCreator(set: SetState<T>, get: GetState<T>) {
          return factory({ get, set });
        };
      };

      // Minimal implementation to satisfy type requirements
      instance.with = () => ({}) as any;
      instance.create = () => ({}) as any;

      return instance as Instance<T, unknown>;
    };

    it('should create a basic instance with primitive values', () => {
      // Create a spy factory to check it receives the get parameter
      const factorySpy = vi.fn(() => ({
        count: 1,
      }));

      const instance = createInstance(
        factorySpy,
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      // Instance should be a function
      expect(typeof instance).toBe('function');

      // The slice creator should be a function
      const sliceCreator = instance();
      const mockSet = vi.fn() as SetState<any>;
      const mockGet = vi.fn() as GetState<any>;

      // Call the slice creator
      const slice = sliceCreator(mockSet, mockGet);

      // Check that the factory is called with the correct parameters
      expect(factorySpy).toHaveBeenCalledWith({ get: mockGet, set: mockSet });

      // Also verify the slice contains the expected primitive value
      expect(slice).toEqual({ count: 1 });
    });

    it('should support methods in state', () => {
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

      // Define a type for our state
      type CounterState = {
        count: number;
        increment: () => number;
      };

      const instance = createInstance<CounterState, unknown>(
        ({ get, set }) => ({
          count: 1,
          increment: () => {
            set((state: CounterState) => ({ count: state.count + 1 }));
            return get().count;
          },
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
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

      // Define a type for our state
      type CounterState = {
        count: number;
        doubleCount: () => number;
      };

      const instance = createInstance<CounterState, unknown>(
        ({ get }) => ({
          count: 1,
          doubleCount: () => get().count * 2,
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
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
  });
}
