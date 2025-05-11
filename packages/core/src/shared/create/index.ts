import type {
  RuntimeTools,
  BaseInstance,
  SliceFactory,
  Finalized,
  GetState,
  SetState,
  ComposedState,
} from '../types';
import { finalizeInstance } from '../validation';
import { createComposedInstance } from '../compose';

/**
 * Creates an instance function that serves as a blueprint.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param markerFn Function to mark the instance as a valid entity
 * @param entityName Name of the entity (model, state, etc.) for error messages
 * @returns An instance function that can be composed with other instances
 */
export function createInstance<T, F = RuntimeTools<T>>(
  factory: (tools: F) => T,
  markerFn: <V>(instance: V) => V,
  entityName: string,
  createEntityFn: <U, E = RuntimeTools<U>>(
    factory: (tools: E) => U
  ) => BaseInstance<U>
): BaseInstance<T> {
  const instance = (): SliceFactory<T> => (options: RuntimeTools<T>) =>
    factory(options as F);

  // Add the .with() method for fluent composition
  instance.with = <U, E = F>(
    // Using a more flexible type signature that works with various factory types
    extensionFactory: (tools: E) => U
  ): BaseInstance<ComposedState<T, U>> => {
    // Create a new instance directly from the extension factory
    // This simplifies the code by removing the unnecessary wrapper function
    // Compose the current instance with the extension instance
    return createComposedInstance(
      instance,
      createEntityFn<U, E>(extensionFactory),
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  // Validate instance for circular references before finalizing
  instance.create = (): Finalized<T> => finalizeInstance(instance, entityName);

  // Mark this as a valid Lattice instance
  return markerFn(instance);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createInstance', () => {
    // Create test doubles for dependencies
    const testMarkerFn = <T>(value: T): T => value;

    const testCreateEntityFn = <T, F = RuntimeTools<T>>(
      factory: (tools: F) => T
    ): BaseInstance<T> => {
      const instance = (): SliceFactory<T> => (options: RuntimeTools<T>) =>
        factory(options as F);

      // Minimal implementation to satisfy type requirements
      instance.with = () => ({}) as any;
      instance.create = () => ({}) as any;

      return instance;
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
      const mockGet: GetState<any> = vi.fn();
      const mockSet: SetState<any> = vi.fn();

      // Call the slice creator
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      // Check that the factory is called with the correct parameters
      expect(factorySpy).toHaveBeenCalledWith({ get: mockGet, set: mockSet });

      // Also verify the slice contains the expected primitive value
      expect(slice).toEqual({ count: 1 });
    });

    it('should support methods in state', () => {
      // Create a simulated state that tracks changes
      let state = { count: 1 };
      const mockSet: SetState<any> = vi.fn(
        (updater: ((state: any) => any) | any) => {
          if (typeof updater === 'function') {
            state = { ...state, ...updater(state) };
          } else {
            state = { ...state, ...updater };
          }
        }
      );
      const mockGet: GetState<any> = vi.fn(() => state);

      // Define a type for our state
      type CounterState = {
        count: number;
        increment: () => number;
      };

      const instance = createInstance<CounterState>(
        ({ get, set }) => ({
          count: 1,
          increment: () => {
            set!((state) => ({ count: state.count + 1 }));
            return get!().count;
          },
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
      const slice = sliceCreator({
        get: mockGet,
        set: mockSet,
      });

      // Call the method and capture its return value
      const result = slice.increment();

      // Verify the set function was called
      expect(mockSet).toHaveBeenCalled();

      // Verify the state was actually updated
      expect(state.count).toBe(2);

      // Verify the method returned the updated value
      expect(result).toBe(2);
    });

    it('should support actions with mutate', () => {
      // Create mock models with the methods we need
      const mockModel = {
        increment: vi.fn(),
        reset: vi.fn(),
      };

      // Define a real mutate function
      const realMutate = <M, K extends keyof M>(model: M, key: K) => {
        return ((...args: any[]) => {
          return (model[key] as any)(...args);
        }) as any;
      };

      // Define a type for our actions
      type CounterActions = {
        increment: () => void;
        reset: () => void;
      };

      const instance = createInstance<CounterActions>(
        ({ mutate }) => ({
          increment: mutate!(mockModel, 'increment'),
          reset: mutate!(mockModel, 'reset'),
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
      const actions = sliceCreator({ mutate: realMutate });

      // Verify actions contains the expected methods
      expect(actions).toHaveProperty('increment');
      expect(actions).toHaveProperty('reset');
      expect(typeof actions.increment).toBe('function');
      expect(typeof actions.reset).toBe('function');

      // Call the actions
      actions.increment();
      actions.reset();

      // Verify the model methods were called
      expect(mockModel.increment).toHaveBeenCalled();
      expect(mockModel.reset).toHaveBeenCalled();
    });
  });
}
